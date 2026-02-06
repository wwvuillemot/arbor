#!/usr/bin/env python3
"""Create a simple tree icon for Arbor"""

from PIL import Image, ImageDraw

# Create a 1024x1024 image with a gradient background
size = 1024
img = Image.new('RGB', (size, size), '#f0f9ff')  # Light blue background
draw = ImageDraw.Draw(img)

# Draw a simple tree
# Tree trunk
trunk_width = 80
trunk_height = 300
trunk_x = (size - trunk_width) // 2
trunk_y = size - trunk_height - 100
draw.rectangle(
    [trunk_x, trunk_y, trunk_x + trunk_width, trunk_y + trunk_height],
    fill='#8b4513'  # Brown
)

# Tree canopy (3 circles to make a tree shape)
canopy_color = '#22c55e'  # Green
center_x = size // 2
center_y = trunk_y - 100

# Bottom circle (largest)
draw.ellipse(
    [center_x - 250, center_y - 50, center_x + 250, center_y + 450],
    fill=canopy_color
)

# Middle circle
draw.ellipse(
    [center_x - 220, center_y - 150, center_x + 220, center_y + 300],
    fill='#16a34a'  # Darker green
)

# Top circle (smallest)
draw.ellipse(
    [center_x - 180, center_y - 220, center_x + 180, center_y + 180],
    fill='#15803d'  # Even darker green
)

# Save the icon
output_path = 'apps/desktop/src-tauri/icons/icon.png'
img.save(output_path)
print(f'✓ Tree icon created: {output_path}')
print('  Run "pnpm tauri icon apps/desktop/src-tauri/icons/icon.png" to generate all sizes')

