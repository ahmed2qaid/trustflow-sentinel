"""Generate synthetic PDFs used by the hackathon demo.

All names, accounts and document identifiers are fictional. No real financial data is used.
"""
from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo-data" / "generated"
OUT.mkdir(parents=True, exist_ok=True)


def pdf(name: str, title: str, lines: list[str]) -> None:
    path = OUT / name
    c = canvas.Canvas(str(path), pagesize=LETTER)
    width, height = LETTER
    c.setTitle(title)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(54, height - 66, title)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 54, height - 62, "SYNTHETIC HACKATHON DEMO")
    y = height - 108
    for line in lines:
        if line == "":
            y -= 12
            continue
        if line.startswith("## "):
            c.setFont("Helvetica-Bold", 11)
            c.drawString(54, y, line[3:])
            c.setFont("Helvetica", 10)
        else:
            c.drawString(54, y, line)
        y -= 17
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(54, 38, "Synthetic document for TrustFlow Sentinel demo. Not a legal or banking instrument.")
    c.save()


pdf("case1_invoice.pdf", "Commercial Invoice", [
    "## Supplier",
    "ABC Manufacturing Inc.",
    "Registration: US-NY-ABC-204",
    "Website: abcmfg.example",
    "",
    "Invoice Number: INV-1008",
    "Contract ID: CF-2026-01",
    "Amount: USD 24,500",
    "Payee: ABC Manufacturing Inc.",
    "Bank Account: US-ABC-1008",
])

pdf("case2_invoice.pdf", "Commercial Invoice", [
    "## Supplier",
    "ABC Manufacturing Inc.",
    "Invoice Number: INV-7812",
    "Contract ID: CF-2026-04",
    "Amount: USD 175,000",
    "",
    "Payment instruction: Pay NorthStar Finance LLC",
    "Bank Account: US-NSF-7821",
])

pdf("case2_assignment.pdf", "Notice of Assignment of Receivables", [
    "Assignor: ABC Manufacturing Inc.",
    "Assignee: NorthStar Finance LLC",
    "Scope: Receivables issued under Contract CF-2026-04",
    "Effective Date: 2026-08-01",
    "Expiration Date: 2027-07-31",
    "",
    "Payments within this scope should be remitted to the assignee during the validity period.",
])

pdf("case2_bank_letter.pdf", "Bank Account Confirmation", [
    "Account Holder: NorthStar Finance LLC",
    "Bank: NorthStar Commercial Bank",
    "Bank Account: US-NSF-7821",
    "Reference: NSF-DEMO-2026",
])

pdf("case3_invoice.pdf", "Commercial Invoice", [
    "Supplier: ABC Manufacturing Inc.",
    "Invoice Number: INV-9001",
    "Contract ID: CF-2026-04",
    "Amount: USD 420,000",
    "",
    "Urgent payment instruction: GlobalPay Holdings",
    "Requested Bank Account: US-GPH-9911",
    "Requested Domain: globalpay-payments.co",
])

pdf("case3_bank_letter.pdf", "Bank Details Letter", [
    "Account Holder: Different Entity LLC",
    "Bank: Unknown Bank",
    "Bank Account: US-DIF-1000",
    "",
    "This bank account does not match the payment request.",
])

print(f"Generated {len(list(OUT.glob('*.pdf')))} PDFs in {OUT}")
