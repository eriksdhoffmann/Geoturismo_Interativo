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
    aspect_target = target_w / target_h
    aspect_im = im.width / im.height
    if aspect_im > aspect_target:
        new_h = target_h
        new_w = int(new_h * aspect_im)
    else:
        new_w = target_w
        new_h = int(new_w / aspect_im)
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))

def make_title_card(t_progress):
    base = Image.new("RGB", (W, H), (10, 25, 47))
    draw = ImageDraw.Draw(base)
    
    for y in range(0, H, 40):
        draw.line([(0, y), (W, y)], fill=(16, 37, 66), width=1)
    for x in range(0, W, 40):
        draw.line([(x, 0), (x, H)], fill=(16, 37, 66), width=1)
        
    draw.rounded_rectangle([(W//2 - 280, 80), (W//2 + 280, 120)], radius=20, fill=(30, 58, 138), outline=(56, 189, 248), width=2)
    draw.text((W//2, 100), "SETUR-SC • PARCERIA UDESC & GEOLAB", fill=(240, 249, 255), anchor="mm")
    
    draw.text((W//2, 210), "Plataforma GeoSC 360°", fill=(255, 255, 255), anchor="mm", font_size=38)
    draw.text((W//2, 265), "Gestão, Inteligência e Promoção Imersiva do Turismo Catarinense", fill=(147, 197, 253), anchor="mm", font_size=20)
    
    pills = [
        ("🚁 Protagonismo Técnico e Trabalho de Campo: GeoLab", 335),
        ("🏛️ Parceria Acadêmica e Institucional: UDESC", 385),
        ("💻 Repositório e Gestão Aberta: GitHub", 435),
        ("🗺️ Implantação Presencial nos Destinos de SC", 485)
    ]
    for text, py in pills:
        draw.rounded_rectangle([(W//2 - 270, py - 18), (W//2 + 270, py + 18)], radius=12, fill=(15, 23, 42), outline=(100, 116, 139), width=1)
        draw.text((W//2, py), text, fill=(226, 232, 240), anchor="mm", font_size=17)
        
    draw.text((W//2, 595), "Apresentação Técnica à Secretaria de Estado do Turismo (SETUR-SC)", fill=(148, 163, 184), anchor="mm", font_size=15)
    draw.text((W//2, 625), "Prof. Chico • Coordenação Técnica GeoLab / UDESC", fill=(203, 213, 225), anchor="mm", font_size=16)
    
    return base

def make_ending_card(t_progress):
    base = Image.new("RGB", (W, H), (15, 23, 42))
    draw = ImageDraw.Draw(base)
    
    draw.rounded_rectangle([(W//2 - 290, 110), (W//2 + 290, 160)], radius=15, fill=(30, 58, 138), outline=(56, 189, 248), width=2)
    draw.text((W//2, 135), "GEOLAB & UDESC • EXECUÇÃO DIRETA", fill=(255, 255, 255), anchor="mm", font_size=18)
    
    draw.text((W//2, 230), "Implantação da Estrutura nos Destinos de Santa Catarina", fill=(248, 250, 252), anchor="mm", font_size=28)
    draw.text((W//2, 280), "Trabalho de Campo, Captação 360°, Modelagem 3D e Gestão via GitHub", fill=(147, 197, 253), anchor="mm", font_size=19)
    
    draw.rounded_rectangle([(W//2 - 380, 340), (W//2 + 380, 510)], radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.text((W//2, 375), "✓ Equipe do GeoLab in loco para implantação da estrutura física e digital", fill=(226, 232, 240), anchor="mm", font_size=17)
    draw.text((W//2, 415), "✓ Parceria com a UDESC e governança pública de dados no GitHub", fill=(226, 232, 240), anchor="mm", font_size=17)
    draw.text((W//2, 455), "✓ Integração com SETUR-SC e prefeituras sem custos de licença por visualização", fill=(226, 232, 240), anchor="mm", font_size=17)
    
    draw.text((W//2, 570), "Contato Técnico: edgar@setur.sc.gov.br", fill=(56, 189, 248), anchor="mm", font_size=20)
    draw.text((W//2, 615), "Secretaria de Estado do Turismo de Santa Catarina • SETUR-SC", fill=(148, 163, 184), anchor="mm", font_size=16)
    
    return base

def make_caption_overlay(img, title, subtitle):
    im_out = img.copy()
    draw = ImageDraw.Draw(im_out)
    
    bar_h = 74
    draw.rectangle([(0, H - bar_h), (W, H)], fill=(15, 23, 42))
    draw.rectangle([(0, H - bar_h), (W, H - bar_h + 3)], fill=(56, 189, 248))
    
    draw.text((40, H - 48), title, fill=(255, 255, 255), anchor="ls", font_size=22)
    draw.text((40, H - 20), subtitle, fill=(148, 163, 184), anchor="ls", font_size=15)
    
    draw.rounded_rectangle([(W - 220, H - 54), (W - 30, H - 18)], radius=10, fill=(30, 58, 138), outline=(96, 165, 250), width=1)
    draw.text((W - 125, H - 36), "GeoLab • UDESC", fill=(240, 249, 255), anchor="mm", font_size=14)
    
    return im_out

def pan_zoom_effect(base_img, t_progress, zoom_start=1.0, zoom_end=1.07, dx=0.06):
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

scenes = [
    {"type": "title", "dur": 4.0},
    {"type": "image", "img": img1, "dur": 6.0, "title": "1. Captação em Campo por Drone pelo GeoLab", "sub": "Navegação imersiva 360° em alta resolução com identificação dos atrativos"},
    {"type": "image", "img": img2, "dur": 6.0, "title": "2. Maquetes 3D e Curadoria Editorial GeoLab", "sub": "Interação com relevo tridimensional e informações do patrimônio cultural"},
    {"type": "image", "img": img3, "dur": 6.0, "title": "3. Mapeamento Integrado dos Destinos de SC", "sub": "Articulação de 21 atrativos no Vale do Rio da Luz e polos regionais"},
    {"type": "image", "img": img4, "dur": 6.0, "title": "4. Gestão Técnica e Integração via GitHub", "sub": "Curadoria do GeoLab com código aberto, UDESC e interface para municípios"},
    {"type": "ending", "dur": 4.0}
]

total_frames = int(sum(s["dur"] for s in scenes) * FPS)
print(f"Generating updated video: {total_frames} frames ({total_frames/FPS:.1f}s) at {W}x{H} {FPS}fps...")

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
            
        raw_bytes = frame.tobytes()
        proc.stdin.write(raw_bytes)
        frame_idx += 1
        if frame_idx % 120 == 0:
            print(f"  Rendered {frame_idx}/{total_frames} frames ({(frame_idx/total_frames)*100:.0f}%)...")

proc.stdin.close()
proc.wait()

if os.path.exists(VIDEO_PATH):
    size_mb = os.path.getsize(VIDEO_PATH) / (1024 * 1024)
    print(f"Updated video generated successfully! Path: {VIDEO_PATH} (Size: {size_mb:.2f} MB)")
else:
    print("Video generation failed!")
