import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
openai_api_key = os.getenv("OPENAI_KEY")

# API 키 설정 (환경 변수 또는 직접 지정)
openAI = OpenAI(api_key=openai_api_key)
