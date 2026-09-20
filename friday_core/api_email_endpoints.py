"""Email API endpoints for Resend integration."""
from fastapi import HTTPException, Header
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from .email_service import EmailService

# Initialize email service
email_service = EmailService()


class SendEmailRequest(BaseModel):
    """Request to send an email."""
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Email subject", min_length=1, max_length=500)
    html: Optional[str] = Field(None, description="HTML email body")
    text: Optional[str] = Field(None, description="Plain text email body")
    cc: Optional[List[str]] = Field(None, description="CC recipients")
    bcc: Optional[List[str]] = Field(None, description="BCC recipients")
    reply_to: Optional[str] = Field(None, description="Reply-to email address")


class SendBulkEmailRequest(BaseModel):
    """Request to send emails to multiple recipients."""
    recipients: List[str] = Field(..., description="List of recipient email addresses")
    subject: str = Field(..., description="Email subject", min_length=1, max_length=500)
    html: Optional[str] = Field(None, description="HTML email body")
    text: Optional[str] = Field(None, description="Plain text email body")


def setup_email_endpoints(app):
    """Register email endpoints on the FastAPI app."""

    @app.get("/email/status")
    def email_status():
        """Get Resend email service status."""
        return email_service.status()

    @app.post("/email/send")
    def send_email(request: SendEmailRequest):
        """Send an email via Resend."""
        result = email_service.send(
            to=request.to,
            subject=request.subject,
            html=request.html,
            text=request.text,
            cc=request.cc,
            bcc=request.bcc,
            reply_to=request.reply_to,
        )

        if not result.success:
            raise HTTPException(
                status_code=503 if "not configured" in result.error.lower() else 400,
                detail=result.error,
            )

        return {
            "success": True,
            "message_id": result.message_id,
            "to": request.to,
            "subject": request.subject,
        }

    @app.post("/email/send-bulk")
    def send_bulk_email(request: SendBulkEmailRequest):
        """Send emails to multiple recipients."""
        if not email_service.configured():
            raise HTTPException(
                status_code=503,
                detail="Email service not configured. Set RESEND_API_KEY.",
            )

        results = email_service.send_bulk(
            recipients=request.recipients,
            subject=request.subject,
            html=request.html,
            text=request.text,
        )

        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]

        return {
            "total": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "results": [
                {
                    "recipient": request.recipients[i],
                    "success": r.success,
                    "message_id": r.message_id,
                    "error": r.error,
                }
                for i, r in enumerate(results)
            ],
        }

