from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.db import db

client = TestClient(app)

def test_demo_seed_creates_real_pdfs():
    # Ensure starting clean
    client.post("/api/demo/reset")
    
    # Check Case 2 documents in database
    docs = db.fetch_all("SELECT file_path FROM documents WHERE request_id = 'case-2-legit-assignment'")
    assert len(docs) == 3, "Case 2 should have 3 documents"
    
    for doc in docs:
        file_path = Path(doc["file_path"])
        assert file_path.exists(), f"File {file_path} does not exist"
        
        # Verify it's a real PDF, not a synthetic text placeholder
        with open(file_path, "rb") as f:
            header = f.read(5)
        assert header == b"%PDF-", f"File {file_path} is not a valid PDF (header: {header})"
        
        # Read file text to ensure no 'Synthetic demo placeholder' string
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                assert "Synthetic demo placeholder" not in content, "Found synthetic placeholder text in demo PDF!"
        except UnicodeDecodeError:
            pass # Valid PDFs are binary, so UnicodeDecodeError is expected and good here.
