#!/usr/bin/env python3
"""Create a simple placeholder icon for Tauri"""

from PIL import Image, ImageDraw, ImageFont

# Create a 1024x1024 image with a blue background
img = Image.new('RGB', (1024, 1024), color='#3b82f6')
d = ImageDraw.Draw(img)

# Try to use a system font, fallback to drawing a circle
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 400)
    d.text((512, 512), 'A', fill='white', anchor='mm', font=font)
except Exception as e:
    print(f"Could not load font: {e}")
    # Draw a white circle as fallback
    d.ellipse([262, 262, 762, 762], fill='white')

# Save the icon
img.save('icon.png')
print('✓ Icon created: icon.png')

