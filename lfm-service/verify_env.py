import sys

print(f"Python version: {sys.version}")

try:
    import torch
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU detected: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Name: {torch.cuda.get_device_name(0)}")
except Exception as e:
    print(f"PyTorch import error: {e}")

try:
    import terratorch
    print(f"TerraTorch version: {terratorch.__version__}")
except Exception as e:
    print(f"TerraTorch import error: {e}")

try:
    import ni_lfm
    import terratorch_integration
    print("NASA LFM package import status: SUCCESS")
except Exception as e:
    print(f"NASA LFM package import error: {e}")
