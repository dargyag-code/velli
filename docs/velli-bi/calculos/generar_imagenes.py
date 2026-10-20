# Imágenes SINTÉTICAS (degradado liviano) con las resoluciones reales de
# Velli y dos tamaños de galería. Nunca fotos de clientas: el costo en
# tokens depende solo de las dimensiones (⌈w/28⌉ × ⌈h/28⌉, con tope).
import sys
from PIL import Image
salida = sys.argv[1]
for (w, h) in [(720, 1280), (1280, 720), (1920, 1080), (3000, 4000)]:
    img = Image.linear_gradient('L').resize((w, h)).convert('RGB')
    img.save(f"{salida}/sint_{w}x{h}.webp", 'WEBP', quality=92)
    print('ok', w, h)
