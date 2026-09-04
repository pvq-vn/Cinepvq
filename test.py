from dotenv import load_dotenv
import os

print("load_dotenv:", load_dotenv())
print("API key:", repr(os.getenv("GEMINI_API_KEY")))