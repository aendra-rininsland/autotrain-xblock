FROM huggingface/autotrain-advanced:latest
CMD pip uninstall -y autotrain-advanced && pip install -U autotrain-advanced && uvicorn autotrain.app:app --host 0.0.0.0 --port 7860 --reload --workers 4
