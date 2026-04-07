Research on project:
https://medium.com/@jameschen_78678/enhancing-image-text-extraction-with-llm-and-ocr-8221cb555cc5
Discusses how to enhance text extraction from an image using a llm.

https://pyimagesearch.com/2021/11/22/improving-ocr-results-with-basic-image-processing/
Walks through processing an image through three filters
Grayscale filter - Uses binary inverse to grayscale the image to make the text pop more
Distance transform - Calculates distance from each pixel used to clean up alot of the noise in the background
Opening Morphological Operation - Disconnects connected blobs and removes noise




Image Enhancement Pipeline - 

Original - Grayscale - Contrast enhancement(CLAHE) - Denoise - Adaptive threshold - Morphology - Resize - OCR 



Key Filters:

Contrast Limited Adaptive Histogram Equalization: 
Contrast - Increasing contract to make text pop by strengthening the difference between the text 
and background

Sharpen Mask - Increase local contast along the edges of letters to improve legibility

High-Pass Filter - Reduces low-frequency information(background noise) while keeping high-frequency 
details

Threshold - Converting the image to black and white and adjusting the threshold

Despeckle/Noise Reduction: If the image is grainy, reducing the noise helps text stand out




to run test 
pytest tests/backend/ -v

run individual tests 
pytest tests/backend/test_auth.py -v
pytest tests/backend/test_notes.py -v
pytest tests/backend/test_notebooks.py -v
pytest tests/backend/test_ai.py -v

run all frontend tests
npx vitest run

run with ui 

npx vitest --ui

run specific file 
npx vitest run tests/frontend/api.test.ts


Test File Summary
Backend File
What it covers
test_auth.py Password hashing, JWT tokens, user CRUD, login flow

test_notes.py Note CRUD, search, image compression, HTML builder
test_notebooks.py Notebook CRUD, add/remove notes, ownership
test_ai.py _clean_json, _call, flashcards, summaries, explanations, auto-categorize

Frontend File What it covers
api.test.ts All API methods, auth headers, 401 expiry handling
Login.Register.test.tsx Form validation, submit, error display, loading states
NotebooksPage.NotebookView.test.tsx Notebook list, CRUD, notes list, modal flows
