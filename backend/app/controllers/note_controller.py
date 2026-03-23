from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile

from app.models.note import Note, ProcessingStatus
from app.models.user import User
from app.schemas.note_schema import NoteUpdate
from app.services.storage import upload_image, delete_image, get_fresh_url

import sys
sys.path.insert(0, '..')
from ocr_service import extract_structured_text


def clean(text: str) -> str:
    return ' '.join(text.split())


class NoteController:

    @staticmethod
    async def create_note(
        db: Session,
        file: UploadFile,
        user: User,
        title: Optional[str] = None,
        note_type: str = "default"
    ) -> Note:
        file_content = await file.read()

        # Upload image to R2 first
        storage_result = upload_image(
            file_bytes=file_content,
            filename=file.filename or "upload.jpg",
            mimetype=file.content_type or "image/jpeg"
        )

        note = Note(
            title=title or file.filename,
            image_key=storage_result["key"],
            image_url=storage_result["url"],
            image_filename=file.filename or "uploaded_image",
            image_mimetype=file.content_type or "image/png",
            status=ProcessingStatus.PROCESSING,
            owner_id=user.id
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        try:
            ocr_result = extract_structured_text(file_content, note_type=note_type)

            if ocr_result.get('error'):
                raise Exception(ocr_result['error'])

            elements = ocr_result.get('elements', [])

            sorted_elements = sorted(
                elements,
                key=lambda e: (
                    e.get('position', {}).get('y_percent', 0),
                    e.get('position', {}).get('x_percent', 0)
                )
            )

            cleaned_elements = NoteController._clean_elements(sorted_elements)
            structured_html = NoteController._build_html(cleaned_elements)

            if not structured_html:
                raw_text = ocr_result.get('raw_text', '')
                structured_html = raw_text.replace('\n', '<br>')

            note.raw_text = ocr_result.get('raw_text', '')
            note.structured_text = structured_html
            note.status = ProcessingStatus.COMPLETED
            note.processed_at = datetime.utcnow()

            db.commit()
            db.refresh(note)

        except Exception as e:
            note.status = ProcessingStatus.FAILED
            note.error_message = str(e)
            db.commit()
            db.refresh(note)

        return note

    @staticmethod
    def get_note_with_image(db: Session, note_id: int, user: User) -> dict:
        note = NoteController.get_note(db, note_id, user)

        # Generate a fresh presigned URL from the stored key
        fresh_url = get_fresh_url(note.image_key) if note.image_key else None

        return {
            "id": note.id,
            "title": note.title,
            "image_filename": note.image_filename,
            "image_mimetype": note.image_mimetype,
            "image_url": fresh_url,          # URL instead of base64
            "raw_text": note.raw_text,
            "structured_text": note.structured_text,
            "subject": note.subject,
            "topic": note.topic,
            "tags": note.tags,
            "status": note.status.value if hasattr(note.status, 'value') else str(note.status),
            "error_message": note.error_message,
            "created_at": note.created_at,
            "processed_at": note.processed_at,
        }

    @staticmethod
    def delete_note(db: Session, note_id: int, user: User) -> None:
        note = NoteController.get_note(db, note_id, user)

        # Delete from R2 before removing DB record
        if note.image_key:
            delete_image(note.image_key)

        db.delete(note)
        db.commit()

    # ── Everything below is unchanged ─────────────────────────────────────────

    @staticmethod
    def _clean_elements(elements: list) -> list:
        box_elements = [
            e for e in elements
            if e.get('container') == 'box' and e.get('type') != 'diagram'
        ]

        def is_connector_shape(el: dict) -> bool:
            if el.get('type') != 'diagram':
                return False
            shape = el.get('diagram', {}).get('shape', 'none')
            if shape not in ('triangle', 'arrow', 'none'):
                return False
            el_y = el.get('position', {}).get('y_percent', 0)
            el_x = el.get('position', {}).get('x_percent', 0)
            for box_el in box_elements:
                box_y = box_el.get('position', {}).get('y_percent', 0)
                box_x = box_el.get('position', {}).get('x_percent', 0)
                if abs(el_x - box_x) < 20 and abs(el_y - box_y) < 25:
                    return True
            return False

        text_regions = set(
            e.get('position', {}).get('region', '')
            for e in elements
            if e.get('type') != 'diagram'
        )

        def is_duplicate_region_diagram(el: dict) -> bool:
            if el.get('type') != 'diagram':
                return False
            return el.get('position', {}).get('region', '') in text_regions

        return [
            e for e in elements
            if not is_connector_shape(e) and not is_duplicate_region_diagram(e)
        ]

    @staticmethod
    def _element_to_html(element: dict) -> str:
        el_type = element.get('type', '')
        content = clean(element.get('content', ''))
        container = element.get('container', 'none')
        style = element.get('style', {})
        children = element.get('children', [])

        box_css = (
            'border: 2px solid #5D4037; border-radius: 4px; '
            'padding: 12px 16px; background: #fff; margin: 10px 0; '
            'display: inline-block; max-width: 100%;'
        )
        circled_css = (
            'border: 2px solid #FF9800; border-radius: 50px; '
            'padding: 4px 16px; display: inline-block; margin: 6px 0;'
        )
        underline_css = 'border-bottom: 2px solid #FF9800; padding-bottom: 3px;'

        if el_type == 'header':
            size = '1.5em' if style.get('is_large') else '1.2em'
            base = (
                f'font-size: {size}; color: #3E2723; margin: 20px 0 10px; '
                f'text-transform: uppercase; letter-spacing: 0.06em;'
            )
            if container == 'box':
                return f'<div style="{box_css}"><h2 style="{base} margin:0;">{content}</h2></div>'
            if container == 'circled':
                return f'<div style="{circled_css}"><h2 style="{base} margin:0;">{content}</h2></div>'
            if container == 'underlined':
                return f'<h2 style="{base} {underline_css}">{content}</h2>'
            return f'<h2 style="{base}">{content}</h2>'

        elif el_type == 'bullet_list':
            bullets = ''.join([
                f'<div style="display:flex;gap:10px;margin-bottom:6px;line-height:1.75;">'
                f'<span style="color:#FF9800;font-weight:bold;flex-shrink:0;">◆</span>'
                f'<span>{clean(child)}</span></div>'
                for child in children
            ])
            if container == 'box':
                return f'<div style="{box_css}">{bullets}</div>'
            if container == 'circled':
                return f'<div style="{circled_css}">{bullets}</div>'
            return f'<div style="margin:12px 0;">{bullets}</div>'

        elif el_type == 'key_value':
            parts = content.split(':', 1)
            inner = (
                f'<span style="color:#FF9800;font-weight:bold;text-transform:uppercase;'
                f'letter-spacing:0.05em;">{parts[0]}:</span> {parts[1]}'
                if len(parts) == 2 else content
            )
            if container == 'box':
                return f'<div style="{box_css}">{inner}</div>'
            return f'<div style="margin:8px 0;line-height:1.75;">{inner}</div>'

        elif el_type == 'diagram':
            diagram = element.get('diagram', {})
            desc = clean(diagram.get('description', content))
            labels = diagram.get('labels', [])
            labels_html = (
                f'<div style="margin-top:6px;color:#FF9800;font-size:0.9em;">'
                f'Labels: {", ".join(clean(l) for l in labels)}</div>'
                if labels else ''
            )
            return (
                f'<div style="border:2px dashed #FFB74D;border-radius:8px;'
                f'padding:16px;margin:12px 0;background:#FFF8E1;'
                f'font-style:italic;color:#5D4037;">'
                f'📊 {desc}{labels_html}</div>'
            )

        else:
            weight = 'bold' if style.get('is_bold') else 'normal'
            base_p = f'margin:10px 0;line-height:1.75;font-weight:{weight};'
            if container == 'box':
                return (
                    f'<div style="{box_css} font-weight:{weight};line-height:1.75;">'
                    f'{content}</div>'
                )
            if container == 'circled':
                return (
                    f'<div style="{circled_css} font-weight:{weight};line-height:1.75;">'
                    f'{content}</div>'
                )
            if container == 'underlined':
                return f'<p style="{base_p}{underline_css}">{content}</p>'
            return f'<p style="{base_p}">{content}</p>'

    @staticmethod
    def _build_html(sorted_elements: list) -> str:
        if not sorted_elements:
            return ''

        bands: list = []
        current_band: list = []

        for el in sorted_elements:
            pos = el.get('position', {})
            y = pos.get('y_percent', 0)

            if not current_band:
                current_band.append(el)
                continue

            band_bottom = max(
                e.get('position', {}).get('y_percent', 0) +
                e.get('position', {}).get('height_percent', 5)
                for e in current_band
            )

            if y < band_bottom + 5:
                current_band.append(el)
            else:
                bands.append(current_band)
                current_band = [el]

        if current_band:
            bands.append(current_band)

        html_parts = []

        for band in bands:
            if len(band) == 1:
                html_parts.append(NoteController._element_to_html(band[0]))
                continue

            left_els = [e for e in band if 'left' in e.get('position', {}).get('region', '')]
            right_els = [e for e in band if 'right' in e.get('position', {}).get('region', '')]

            if left_els and right_els:
                right_x = min(e.get('position', {}).get('x_percent', 50) for e in right_els)
                left_x = min(e.get('position', {}).get('x_percent', 0) for e in left_els)
                right_x = max(20, min(80, right_x))
                left_fr = round(right_x - left_x)
                right_fr = round(100 - right_x)
                if left_fr <= 0:
                    left_fr = 50
                if right_fr <= 0:
                    right_fr = 50

                left_html = ''.join(NoteController._element_to_html(e) for e in left_els)
                right_html = ''.join(NoteController._element_to_html(e) for e in right_els)

                html_parts.append(
                    f'<div style="display:grid;grid-template-columns:{left_fr}fr {right_fr}fr;'
                    f'gap:24px;margin:12px 0;">'
                    f'<div>{left_html}</div>'
                    f'<div>{right_html}</div>'
                    f'</div>'
                )
            else:
                for el in sorted(band, key=lambda e: e.get('position', {}).get('x_percent', 0)):
                    html_parts.append(NoteController._element_to_html(el))

        return ''.join(html_parts)

    @staticmethod
    def get_notes(db: Session, user: User, skip: int = 0, limit: int = 100) -> List[Note]:
        return db.query(Note).filter(
            Note.owner_id == user.id
        ).order_by(Note.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def search_notes(db: Session, user: User, query: str, subject: Optional[str] = None, topic: Optional[str] = None) -> List[Note]:
        from sqlalchemy import or_
        q = db.query(Note).filter(Note.owner_id == user.id)

        if query:
            search = f"%{query}%"
            q = q.filter(or_(
                Note.title.ilike(search),
                Note.raw_text.ilike(search),
                Note.subject.ilike(search),
                Note.topic.ilike(search),
                Note.tags.ilike(search),
            ))

        if subject:
            q = q.filter(Note.subject == subject)
        if topic:
            q = q.filter(Note.topic == topic)

        return q.order_by(Note.created_at.desc()).all()

    @staticmethod
    def get_subjects_and_topics(db: Session, user: User) -> dict:
        notes = db.query(Note).filter(Note.owner_id == user.id).all()
        subjects = sorted(set(n.subject for n in notes if n.subject))
        topics = sorted(set(n.topic for n in notes if n.topic))
        all_tags: set = set()
        for n in notes:
            if n.tags:
                for tag in n.tags.split(','):
                    tag = tag.strip()
                    if tag:
                        all_tags.add(tag)
        return {"subjects": subjects, "topics": topics, "tags": sorted(all_tags)}

    @staticmethod
    def get_note(db: Session, note_id: int, user: User) -> Note:
        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )
        return note

    @staticmethod
    def update_note(db: Session, note_id: int, update_data: NoteUpdate, user: User) -> Note:
        note = NoteController.get_note(db, note_id, user)
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(note, field, value)
        db.commit()
        db.refresh(note)
        return note


note_controller = NoteController()