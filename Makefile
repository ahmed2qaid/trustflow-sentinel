.PHONY: api web test demo-data

api:
	cd apps/api && uvicorn app.main:app --reload --port 8000

web:
	cd apps/web && npm run dev

test:
	cd apps/api && pytest -q && ruff check .
	cd apps/web && npm run build && npm run lint

demo-data:
	python scripts/generate_demo_pdfs.py
