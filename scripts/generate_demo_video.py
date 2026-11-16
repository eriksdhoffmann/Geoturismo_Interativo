import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
import subprocess

OUTPUT_DIR = os.path.abspath(r"C:\Users\Win11\Downloads\Geohereditas\SETUR_SC_Anexos")
VIDEO_PATH = os.path.join(OUTPUT_DIR, "GeoSC_360_Demonstracao_SETUR.mp4")

# Load capture images
img1_path = os.path.join(OUTPUT_DIR, "Demonstracao_1_Interface_Navegacao_Drone_360.png")
img2_path = os.path.join(OUTPUT_DIR, "Demonstracao_2_SplitView_Modelo_3D_Interativo.png")
img3_path = os.path.join(OUTPUT_DIR, "Demonstracao_3_Mapa_Interativo_Roteiro_Turistico.png")
img4_path = os.path.join(OUTPUT_DIR, "Demonstracao_4_Estudio_Gestor_Municipal_Input_Dados.png")

img1 = Image.open(img1_path).convert("RGB")
img2 = Image.open(img2_path).convert("RGB")
img3 = Image.open(img3_path).convert("RGB")
img4 = Image.open(img4_path).convert("RGB")

W, H = 1280, 720
FPS = 30

def resize_cover(im, target_w, target_h):
    # Scale to cover target size
    aspect_target = target_w / target_h
    aspect_im = im.width / im.height
    if aspect_im > aspect_target:
        new_h = target_h
        new_w = int(new_h * aspect_im)
    else:
        new_w = target_w
        new_h = int(new_w / aspect_im)
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    # Center crop
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))

def make_title_card(t_progress):
    # Professional dark blue / teal gradient background
    base = Image.new("RGB", (W, H), (10, 25, 47))
    draw = ImageDraw.Draw(base)
    
    # Subdued decorative grid/accents
    for y in range(0, H, 40):
        draw.line([(0, y), (W, y)], fill=(16, 37, 66), width=1)
    for x in range(0, W, 40):
        draw.line([(x, 0), (x, H)], fill=(16, 37, 66), width=1)
        
    # Top badge
    draw.rounded_rectangle([(W//2 - 260, 90), (W//2 + 260, 130)], radius=20, fill=(30, 58, 138), outline=(56, 189, 248), width=2)
    draw.text((W//2, 110), "GOVERNO DE SANTA CATARINA • SETUR-SC", fill=(240, 249, 255), anchor="mm")
    
    # Main title
    draw.text((W//2, 220), "GeoSC 360° — Geoturismo & Inteligência", fill=(255, 255, 255), anchor="mm", font_size=36)
    draw.text((W//2, 275), "Solução Tecnológica para Gestão, Inteligência e Promoção do Turismo", fill=(147, 197, 253), anchor="mm", font_size=20)
    
    # Feature Pills
    pills = [
        ("🚁 Drones 360° WebGL", 340),
        ("🧊 Modelos 3D Interativos (.GLB)", 390),
        ("🗺️ Roteiros Georreferenciados", 440),
        ("🛠️ Alimentação Autônoma pelos Municípios", 490)
    ]
    for text, py in pills:
        draw.rounded_rectangle([(W//2 - 240, py - 18), (W//2 + 240, py + 18)], radius=12, fill=(15, 23, 42), outline=(100, 116, 139), width=1)
        draw.text((W//2, py), text, fill=(226, 232, 240), anchor="mm", font_size=17)
        
    draw.text((W//2, 600), "Apresentação Técnica para a Secretaria de Estado do Turismo (SETUR-SC)", fill=(148, 163, 184), anchor="mm", font_size=15)
    draw.text((W//2, 630), "Prof. Chico • Coordenação do Projeto GeoSC / Geohereditas", fill=(203, 213, 225), anchor="mm", font_size=16)
    
    return base

def make_ending_card(t_progress):
    base = Image.new("RGB", (W, H), (15, 23, 42))
    draw = ImageDraw.Draw(base)
    
    # Banner
    draw.rounded_rectangle([(W//2 - 280, 120), (W//2 + 280, 170)], radius=15, fill=(30, 58, 138), outline=(56, 189, 248), width=2)
    draw.text((W//2, 145), "SOLUÇÃO PRONTA PARA OPERAÇÃO ESTADUAL", fill=(255, 255, 255), anchor="mm", font_size=18)
    
    draw.text((W//2, 240), "Pronto para Integração com os 295 Municípios de SC", fill=(248, 250, 252), anchor="mm", font_size=30)
    draw.text((W//2, 290), "Arquitetura 100% Aberta, Leve e de Baixíssimo Custo Operacional", fill=(147, 197, 253), anchor="mm", font_size=20)
    
    # Box Summary
    draw.rounded_rectangle([(W//2 - 380, 350), (W//2 + 380, 510)], radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.text((W//2, 385), "✓ Compatível com Celulares, Tablets, Totens e Desktops (Sem App)", fill=(226, 232, 240), anchor="mm", font_size=18)
    draw.text((W//2, 425), "✓ Painel para Gestores Municipais cadastrarem novos atrativos", fill=(226, 232, 240), anchor="mm", font_size=18)
    draw.text((W//2, 465), "✓ Valorização do Geoturismo, Ecoturismo e Patrimônio Cultural", fill=(226, 232, 240), anchor="mm", font_size=18)
    
    draw.text((W//2, 570), "Contato Técnico: edgar@setur.sc.gov.br", fill=(56, 189, 248), anchor="mm", font_size=20)
    draw.text((W//2, 615), "Secretaria de Estado do Turismo de Santa Catarina", fill=(148, 163, 184), anchor="mm", font_size=16)
    
    return base

def make_caption_overlay(img, title, subtitle):
    im_out = img.copy()
    draw = ImageDraw.Draw(im_out)
    
    # Lower third bar
    bar_h = 74
    draw.rectangle([(0, H - bar_h), (W, H)], fill=(15, 23, 42))
    draw.rectangle([(0, H - bar_h), (W, H - bar_h + 3)], fill=(56, 189, 248))
    
    draw.text((40, H - 48), title, fill=(255, 255, 255), anchor="ls", font_size=22)
    draw.text((40, H - 20), subtitle, fill=(148, 163, 184), anchor="ls", font_size=15)
    
    # Right pill
    draw.rounded_rectangle([(W - 220, H - 54), (W - 30, H - 18)], radius=10, fill=(30, 58, 138), outline=(96, 165, 250), width=1)
    draw.text((W - 125, H - 36), "GeoSC 360° • SETUR", fill=(240, 249, 255), anchor="mm", font_size=14)
    
    return im_out

def pan_zoom_effect(base_img, t_progress, zoom_start=1.0, zoom_end=1.08, dx=0.04):
    zoom = zoom_start + (zoom_end - zoom_start) * t_progress
    crop_w = int(base_img.width / zoom)
    crop_h = int(base_img.height / zoom)
    
    max_x = base_img.width - crop_w
    max_y = base_img.height - crop_h
    
    offset_x = int(max_x * (0.5 + dx * (t_progress - 0.5)))
    offset_y = int(max_y * 0.5)
    
    offset_x = max(0, min(offset_x, max_x))
    offset_y = max(0, min(offset_y, max_y))
    
    cropped = base_img.crop((offset_x, offset_y, offset_x + crop_w, offset_y + crop_h))
    return cropped.resize((W, H), Image.Resampling.LANCZOS)

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
print(f"Using ffmpeg at: {ffmpeg_exe}")

cmd = [
    ffmpeg_exe,
    "-y",
    "-f", "rawvideo",
    "-vcodec", "rawvideo",
    "-s", f"{W}x{H}",
    "-pix_fmt", "rgb24",
    "-r", str(FPS),
    "-i", "-",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "22",
    "-movflags", "+faststart",
    VIDEO_PATH
]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

# Sequence configuration
# 1. Intro Card (4 sec = 120 frames)
# 2. Img 1: Overview 360 Drone (6 sec = 180 frames)
# 3. Img 2: Split View 3D Model (6 sec = 180 frames)
# 4. Img 3: Interactive Illustrated Map (6 sec = 180 frames)
# 5. Img 4: Municipal Input Studio (6 sec = 180 frames)
# 6. Ending Card (4 sec = 120 frames)
# Total: 32 seconds = 960 frames

scenes = [
    {"type": "title", "dur": 4.0},
    {"type": "image", "img": img1, "dur": 6.0, "title": "1. Imersão 360° em Alta Resolução por Drone", "sub": "Interface WebGL suave com hotspots clicáveis e rótulos 3D de relevo"},
    {"type": "image", "img": img2, "dur": 6.0, "title": "2. Pop-up Split-View: Maquete 3D & Interpretação", "sub": "Visualização tridimensional interativa (.GLB) e texto editorial patrimonial"},
    {"type": "image", "img": img3, "dur": 6.0, "title": "3. Roteiro Turístico & Mapa Georreferenciado", "sub": "Integração visual de todos os atrativos, patrimônio enxaimel e gastronomia"},
    {"type": "image", "img": img4, "dur": 6.0, "title": "4. Estúdio Gestor Municipal: Entrada de Dados", "sub": "Municípios e SETUR-SC inserem fotos 360°, textos e pontos sem programar"},
    {"type": "ending", "dur": 4.0}
]

total_frames = int(sum(s["dur"] for s in scenes) * FPS)
print(f"Generating video: {total_frames} frames ({total_frames/FPS:.1f}s) at {W}x{H} {FPS}fps...")

frame_idx = 0
for sc in scenes:
    n_frames = int(sc["dur"] * FPS)
    for i in range(n_frames):
        prog = i / max(1, n_frames - 1)
        if sc["type"] == "title":
            frame = make_title_card(prog)
        elif sc["type"] == "ending":
            frame = make_ending_card(prog)
        else:
            pz = pan_zoom_effect(sc["img"], prog, zoom_start=1.0, zoom_end=1.07, dx=0.06)
            frame = make_caption_overlay(pz, sc["title"], sc["sub"])
            
        # Subtle crossfade at scene boundaries (10 frames)
        raw_bytes = frame.tobytes()
        proc.stdin.write(raw_bytes)
        frame_idx += 1
        if frame_idx % 120 == 0:
            print(f"  Rendered {frame_idx}/{total_frames} frames ({(frame_idx/total_frames)*100:.0f}%)...")

proc.stdin.close()
proc.wait()

if os.path.exists(VIDEO_PATH):
    size_mb = os.path.getsize(VIDEO_PATH) / (1024 * 1024)
    print(f"Video generated successfully! Path: {VIDEO_PATH} (Size: {size_mb:.2f} MB)")
else:
    print("Video generation failed!")
