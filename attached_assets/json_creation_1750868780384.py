import os
import json
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import re

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise EnvironmentError("OPENAI_API_KEY not found in .env file.")
client = OpenAI(api_key=api_key)

REQUIRED_KEYS = [
    "Agency", "Person Name", "Shift details", "Start data", "Time sheet number", "Hours charged",
    "Pay Rate", "Gross Pay", "Employe type (LTD/PAYE)", "Total Received", "Customer Code",
    "Suplier Code", "Shift", "Remittance number", "Remittance Data", "Status", "Remittance Status",
    "Primo Status", "Shift Data", "Invoice Status", "Coda Agency Reference", "Code Reference",
    "Invoice Description", "PP Reference"
]

def normalize_key(key):
    return re.sub(r'\W+', '', key).lower()

def search_key(key_to_search, json_data):
    normalized_target = normalize_key(key_to_search)
    results = []
    def recursive_search(data):
        if isinstance(data, dict):
            for k, v in data.items():
                if normalize_key(k) == normalized_target:
                    results.append(v)
                recursive_search(v)
        elif isinstance(data, list):
            for item in data:
                recursive_search(item)
    recursive_search(json_data)
    return results

def extract_entities_from_text(text: str, required_keys: list[str]) -> dict:
    keys_str = ", ".join(f'"{key}"' for key in required_keys)
    prompt = f"""
You are an expert in extracting structured data from OCR outputs.

The following OCR text contains records of multiple people. A person may have multiple entries (e.g., for different pay periods or types), and the same name may appear multiple times. The document may also contain a summary or total section at the end.

Your goal is to extract the following:

1. "records" — a list of individual entries:
- Each line or logical block represents one record for a person.
- If the same person appears multiple times, include each entry separately.
- If multiple people appear, extract records for all of them.
- Extract exactly the following fields for each record:
  [{keys_str}]
- If a field is missing, set it to an empty string.
- Each record should be a dictionary with all the keys in the list, even if some values are empty.

2. "Agency Name" — a single dictionary:
- This represents document-level summary or remittance totals.
- Extract relevant summary-level values such as:
  - Total Gross Pay
  - Net Pay
  - Fee (this includes the sum of all types of -ve values being minused from the total gross pay) 
  - Total Hours
  - Final Totals
  - Remittance amounts
- Do not structure this like a person record.
- There should only be one agency per OCR document, so extract the agency name as the key and a dictionary of relevant values as its value.
- Do not use a key called "Others". Always use the actual agency name as the dictionary key.

3. Do not create a person record where the person name is "Other" or "Others". Only valid names should be accepted.
4. You will not calculate any totals — return values exactly as found in the text. A field called "Manual Total Gross Pays" will be added later manually in the code.
Return a valid JSON object with the following structure:

{{
  "records": [
    {{ "Agency": "...", "Person Name": "...", "...": "...", "PP Reference": "..." }},
    ...
  ],
  "Agency Name": {{
    "<agency_name>": {{
      "Total Gross Pay": "...",
      "VAT Rate": "...", 
      "Fee": "...",
      "Total Amount Paid": "...",
    }}
  }}
}}
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt + "\n\nHere is the OCR text:\n" + text}],
        temperature=0
    )

    content = response.choices[0].message.content.strip()
    if content.startswith("```json") or content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)

    try:
        return json.loads(content)
    except Exception as e:
        print("Failed to parse valid JSON:", e)
        print("Raw content was:\n", content)
        raise

def create_JSON(folder_path: str, required_keys: list[str], output_dir: str):
    folder = Path(folder_path).resolve()
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    txt_files = list(folder.glob("*.txt"))
    if not txt_files:
        print("No .txt files found.")
        return {}

    results = {}

    for file in txt_files:
        print(f"\nProcessing {file.name}...")
        with open(file, "r", encoding="utf-8") as f:
            text = f.read()

        try:
            print("Extracting entities from OCR text via OpenAI...")
            entities = extract_entities_from_text(text, required_keys)

            if not isinstance(entities, dict) or "records" not in entities or "Agency Name" not in entities:
                raise ValueError("Invalid response structure from OpenAI.")

            agency_block = entities["Agency Name"]
            agency_name = next(iter(agency_block))
            if normalize_key(agency_name) == "others":
                raise ValueError("Agency name was extracted as 'Others', which is not allowed.")

            clean_records = []
            for record in entities["records"]:
                person_name = record.get("Person Name", "").strip().lower()
                if person_name in {"other", "others"}:
                    continue
                if not record.get("Agency"):
                    record["Agency"] = agency_name
                clean_records.append(record)

            entities["records"] = clean_records

            gross_pays = search_key("Gross Pay", clean_records)

            total_manual_gross = 0.0

            for gp in gross_pays:
                try:
                    value = re.sub(r"[^\d.\-]", "", str(gp))
                    if value:
                        total_manual_gross += float(value)
                except Exception: 
                    continue

            real_agency_name = entities["records"][0].get("Agency", "").strip()
            if not real_agency_name:
                raise ValueError("Missing agency name in record.")

            summary_data = entities.pop("Agency Name", {}).get(agency_name, {})
            summary_data["Manual Total Gross Pays"] = total_manual_gross
            entities[real_agency_name] = summary_data

            json_filename = output_path / f"{file.stem}.json"
            print(f"Saving JSON to: {json_filename}")
            with open(json_filename, "w", encoding="utf-8") as jf:
                json.dump(entities, jf, indent=2)

            results[file.name] = entities

        except Exception as e:
            print(f"Error processing {file.name}: {e}")
            results[file.name] = {"error": str(e)}

    return results
