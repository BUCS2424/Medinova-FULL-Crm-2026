"""
Gemini AI Clinical Diagnostic Assistant
POST /api/gemini/diagnose — accepts patient symptoms, returns DME recommendations + ICD-10 suggestions
"""
import os
import uuid
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

gemini_router = APIRouter(prefix="/gemini", tags=["gemini"])


class DiagnoseRequest(BaseModel):
    symptoms: str
    context: Optional[str] = None


@gemini_router.post("/diagnose")
async def diagnose_symptoms(data: DiagnoseRequest):
    """AI clinical assistant: analyze symptoms and suggest DME products + ICD-10 codes."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured. Add EMERGENT_LLM_KEY to backend .env")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="emergentintegrations library not installed. Run: pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/"
        )

    system_message = """You are a clinical assistant AI for a DME (Durable Medical Equipment) provider called MediNova Medical Supplies.
Your role is to analyze patient symptoms during telehealth consultations and provide structured clinical guidance.

Always respond in this format:

**Assessment Summary**
Brief 1-2 sentence clinical summary.

**Potential DME Products**
- Product name (rationale)
- Product name (rationale)

**Key Assessment Questions**
- Question for provider to ask patient
- Question for provider to ask patient

**Suggested ICD-10 Codes**
- Code: Description
- Code: Description

**Important Notes**
Any red flags, contraindications, or prior auth considerations.

Keep responses concise, structured, and clinically relevant. This is for provider guidance only — not a patient diagnosis."""

    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message=system_message,
    ).with_model("gemini", "gemini-2.5-flash")

    prompt = f"Patient symptoms: {data.symptoms}"
    if data.context:
        prompt += f"\n\nAdditional context: {data.context}"

    try:
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return {"diagnosis": response, "symptoms": data.symptoms}
    except Exception as e:
        logger.error(f"Gemini diagnose error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
