import json
import re
from pathlib import Path

def tokenize(text):
    text = text.lower()
    return set(re.findall(r'[a-z0-9\u00c0-\u017f]+', text))

def main():
    policy_path = Path("policy/electro_ekom.v0.1.json")
    if not policy_path.exists():
        print("Policy file not found.")
        return

    with open(policy_path, "r", encoding="utf-8") as f:
        policy_data = json.load(f)

    chunks = []
    for source in policy_data.get("sources", []):
        content_parts = [
            source.get("title", ""),
            source.get("reference", ""),
            source.get("consideration", ""),
            source.get("expected_evidence", ""),
            source.get("publisher", ""),
            source.get("trigger", "")
        ]
        full_text = " ".join(content_parts)
        tokens = list(tokenize(full_text))
        
        chunks.append({
            "id": source.get("id"),
            "families": source.get("families", []),
            "source_class": source.get("source_class"),
            "title": source.get("title"),
            "reference": source.get("reference"),
            "url": source.get("url"),
            "consideration": source.get("consideration"),
            "expected_evidence": source.get("expected_evidence"),
            "trigger": source.get("trigger"),
            "conditions": source.get("conditions", {}),
            "tokens": tokens
        })

    # Save local index
    output_path = Path("policy/vector_store.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    print(f"Ingested {len(chunks)} policy rules into {output_path}")

if __name__ == "__main__":
    main()
