"""AI Content Generator for location pages using OpenAI GPT-4"""
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


async def generate_location_content(
    product_type: str,
    location_name: str,
    state_name: str,
    level: str = "city",  # city, county, or state
    keywords: list = None,
    company_name: str = "MEDVera"
) -> dict:
    """
    Generate unique AI content for a specific location page.
    
    Args:
        product_type: e.g., "Weight Loss", "Sexual Health"
        location_name: e.g., "Birmingham", "Jefferson County", "Alabama"
        state_name: e.g., "Alabama"
        level: "city", "county", or "state"
        keywords: Optional list of keywords to include
    
    Returns:
        dict with keys: title, headline, intro, content_body, meta_description
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")
    
    # Build the prompt
    location_context = f"{location_name}, {state_name}" if location_name != state_name else state_name
    keyword_context = f"\nInclude these keywords naturally: {', '.join(keywords)}" if keywords else ""
    
    prompt = f"""Write unique, SEO-optimized content for a {product_type} services page targeting {location_context}.

Requirements:
- Write in a professional, trustworthy, medical tone
- Focus on local availability and accessibility in {location_context}
- Make it sound personal and human (not corporate)
- Avoid excessive medical jargon
- Include a clear call-to-action
- Length: 300-400 words for the main content
- Be specific to {level}-level service area{keyword_context}

Generate the following sections:

1. HEADLINE: Catchy, benefit-focused headline (max 80 chars)
2. INTRO: Opening paragraph that hooks the reader (2-3 sentences)
3. CONTENT_BODY: Main content (300-400 words, formatted in 3-4 paragraphs)
4. META_DESCRIPTION: SEO meta description (150-155 chars)

Format your response as JSON:
{{
    "headline": "...",
    "intro": "...",
    "content_body": "...",
    "meta_description": "..."
}}"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",  # Cost-effective for 33K pages
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert medical content writer specializing in telehealth and healthcare services. Write engaging, trustworthy content that converts visitors into patients."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.8,  # Variety for uniqueness
                    "response_format": {"type": "json_object"}
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            # Parse the response
            import json
            content = json.loads(result["choices"][0]["message"]["content"])
            
            # Build title
            title = f"{content['headline']} | {company_name}"
            
            logger.info(f"Generated AI content for {location_context} - {product_type}")
            
            return {
                "title": title,
                "headline": content["headline"],
                "intro": content["intro"],
                "content_body": content["content_body"],
                "meta_description": content["meta_description"]
            }
            
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
        raise Exception(f"OpenAI API error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Failed to generate AI content: {str(e)}")
        raise
