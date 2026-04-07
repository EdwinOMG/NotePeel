import sys
import os
import pytest

# Add the current directory (backend/) to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Your existing fixture
@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"