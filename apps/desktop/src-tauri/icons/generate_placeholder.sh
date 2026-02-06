#!/bin/bash
# Generate a simple placeholder icon for Tauri

cd "$(dirname "$0")"

# Create a 1024x1024 PNG with a simple tree-like shape using Python
python3 << 'PYTHON'
from PIL import Image, ImageDraw

# Create image
size = 1024
img = Image.new('RGBA', (size, size), (59, 130, 246, 255))  # Blue background

draw = ImageDraw.Draw(img)

# Draw a simple tree trunk (brown rectangle)
trunk_width = 120
trunk_height = 400
trunk_x = (size - trunk_width) // 2
trunk_y = size - trunk_height - 50
draw.rectangle(
    [trunk_x, trunk_y, trunk_x + trunk_width, trunk_y + trunk_height],
    fill=(139, 69, 19, 255)  # Brown
)

# Draw tree foliage (green circle)
center_x = size // 2
center_y = trunk_y - 150
radius = 300
draw.ellipse(
    [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
    fill=(34, 197, 94, 255)  # Green
)

# Save
img.save('icon.png')
print('✓ Placeholder icon created: icon.png')
PYTHON

echo "✓ Icon generation complete"

