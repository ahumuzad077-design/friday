"""Email service using Resend API for outbound communications."""
import os
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

try:
    from resend import Resend
except ImportError:
    Resend = None

logger = logging.getLogger(__name__)


@dataclass
class EmailResult:
    """Result of an email send operation."""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    timestamp: Optional[str] = None


class EmailService:
    """Manages email sending via Resend API."""

    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
        self.client = None

        if self.api_key and Resend:
            try:
                self.client = Resend(api_key=self.api_key)
                logger.info("Resend email service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Resend: {e}")
        elif not Resend:
            logger.warning("Resend SDK not installed. Email sending disabled.")
        elif not self.api_key:
            logger.warning("RESEND_API_KEY not configured. Email sending disabled.")

    def configured(self) -> bool:
        """Check if email service is properly configured."""
        return self.client is not None

    def send(
        self,
        to: str,
        subject: str,
        html: Optional[str] = None,
        text: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
    ) -> EmailResult:
        """
        Send an email via Resend.

        Args:
            to: Recipient email address
            subject: Email subject
            html: HTML email body
            text: Plain text email body (fallback)
            cc: List of CC recipients
            bcc: List of BCC recipients
            reply_to: Reply-to email address

        Returns:
            EmailResult with success status and message ID or error
        """
        if not self.configured():
            return EmailResult(
                success=False,
                error="Resend not configured. Set RESEND_API_KEY environment variable.",
            )

        if not html and not text:
            return EmailResult(
                success=False,
                error="Either html or text content is required",
            )

        try:
            # Build email payload
            params = {
                "from": self.from_email,
                "to": to,
                "subject": subject,
            }

            if html:
                params["html"] = html
            if text:
                params["text"] = text
            if cc:
                params["cc"] = cc
            if bcc:
                params["bcc"] = bcc
            if reply_to:
                params["reply_to"] = reply_to

            # Send email
            response = self.client.emails.send(**params)

            if response.get("id"):
                logger.info(f"Email sent successfully. Message ID: {response['id']}")
                return EmailResult(
                    success=True,
                    message_id=response.get("id"),
                )
            else:
                error = response.get("error", "Unknown error")
                logger.error(f"Failed to send email: {error}")
                return EmailResult(
                    success=False,
                    error=str(error),
                )

        except Exception as e:
            logger.error(f"Email send exception: {type(e).__name__}: {e}")
            return EmailResult(
                success=False,
                error=f"{type(e).__name__}: {str(e)}",
            )

    def send_bulk(
        self,
        recipients: List[str],
        subject: str,
        html: Optional[str] = None,
        text: Optional[str] = None,
    ) -> List[EmailResult]:
        """
        Send emails to multiple recipients.

        Args:
            recipients: List of email addresses
            subject: Email subject
            html: HTML email body
            text: Plain text email body

        Returns:
            List of EmailResult objects
        """
        results = []
        for recipient in recipients:
            result = self.send(
                to=recipient,
                subject=subject,
                html=html,
                text=text,
            )
            results.append(result)
        return results

    def send_templated(
        self,
        to: str,
        subject: str,
        template_variables: Dict[str, Any],
        template_html: str,
    ) -> EmailResult:
        """
        Send an email with template variable substitution.

        Args:
            to: Recipient email
            subject: Email subject
            template_variables: Dict of variables to replace in template
            template_html: HTML template with {{variable}} placeholders

        Returns:
            EmailResult with success status
        """
        # Simple template variable substitution
        html = template_html
        for key, value in template_variables.items():
            html = html.replace(f"{{{{{key}}}}}", str(value))

        return self.send(
            to=to,
            subject=subject,
            html=html,
        )

    def status(self) -> Dict[str, Any]:
        """Get email service status."""
        return {
            "configured": self.configured(),
            "from_email": self.from_email,
            "api_key_present": bool(self.api_key),
        }

