"""
AI Service
- OpenAI GPT integration
- Template editing
- Newsletter generation
"""
import logging
import os

from emergentintegrations.llm.chat import chat, LlmConfig

logger = logging.getLogger(__name__)


class AIService:
    """AI service using OpenAI GPT via Emergent integrations"""
    
    _api_key = None
    
    @classmethod
    def get_api_key(cls):
        """Get the Emergent LLM API key"""
        if not cls._api_key:
            cls._api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("LLM_KEY")
        return cls._api_key
    
    @classmethod
    async def generate_text(cls, prompt: str, system_prompt: str = None, model: str = "gpt-5.2"):
        """Generate text using AI"""
        api_key = cls.get_api_key()
        if not api_key:
            return None, "AI service not configured"
        
        try:
            config = LlmConfig(
                api_key=api_key,
                model=model,
                max_tokens=4096,
                temperature=0.7
            )
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            response = await chat(config=config, messages=messages)
            return response, None
            
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            return None, str(e)
    
    @classmethod
    async def edit_template(cls, template_content: str, instructions: str):
        """Edit a template using AI"""
        system_prompt = """You are a professional template editor for a healthcare DME company.
        Edit the provided template according to the user's instructions.
        Maintain professional language and HIPAA compliance.
        Return only the edited template content, nothing else."""
        
        prompt = f"""Template to edit:
{template_content}

Instructions: {instructions}

Provide the edited template:"""
        
        return await cls.generate_text(prompt, system_prompt)
    
    @classmethod
    async def generate_newsletter(cls, topic: str, company_info: dict = None):
        """Generate newsletter content"""
        company_name = company_info.get("name", "Mastech DME") if company_info else "Mastech DME"
        
        system_prompt = f"""You are a professional healthcare marketing writer for {company_name}, 
        a Durable Medical Equipment company. Create engaging, informative newsletter content.
        Use a professional but friendly tone. Include relevant medical equipment information."""
        
        prompt = f"""Write a professional newsletter about: {topic}

Include:
1. An engaging subject line
2. A compelling introduction
3. Main content (2-3 paragraphs)
4. A call to action
5. Professional sign-off

Format as HTML with basic styling."""
        
        return await cls.generate_text(prompt, system_prompt)
