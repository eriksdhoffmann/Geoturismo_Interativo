import http.server
import socketserver
import threading
import subprocess
import os
import time

PORT = 8769
DOC_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(DOC_ROOT, "SETUR_SC_Anexos")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOC_ROOT, **kwargs)
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
t = threading.Thread(target=httpd.serve_forever, daemon=True)
t.start()
print(f"HTTP Server started on 127.0.0.1:{PORT} serving {DOC_ROOT}")

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

shots = [
    {
        "name": "Demonstracao_1_Interface_Navegacao_Drone_360.png",
        "url": f"http://127.0.0.1:{PORT}/index.html",
        "budget": 4500
    },
    {
        "name": "Demonstracao_2_SplitView_Modelo_3D_Interativo.png",
        "url": f"http://127.0.0.1:{PORT}/index.html?action=modal3d",
        "budget": 5000
    },
    {
        "name": "Demonstracao_3_Mapa_Interativo_Roteiro_Turistico.png",
        "url": f"http://127.0.0.1:{PORT}/index.html?action=map",
        "budget": 5000
    },
    {
        "name": "Demonstracao_4_Estudio_Gestor_Municipal_Input_Dados.png",
        "url": f"http://127.0.0.1:{PORT}/index.html?action=editor",
        "budget": 5000
    }
]

for s in shots:
    out_path = os.path.join(OUTPUT_DIR, s["name"])
    print(f"Capturing {s['name']}...")
    cmd = [
        chrome_path,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--window-size=1920,1080",
        f"--virtual-time-budget={s['budget']}",
        f"--screenshot={out_path}",
        s["url"]
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
    if os.path.exists(out_path):
        size_kb = os.path.getsize(out_path) / 1024
        print(f"  -> OK! Size: {size_kb:.1f} KB")
    else:
        print(f"  -> ERROR! File not found. Stderr: {res.stderr}")

httpd.shutdown()
print("All captures completed!")
