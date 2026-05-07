#!/usr/bin/env python3
import os

# Change to the directory
os.chdir(r'f:\Downloads\THESIS\working lahat pati tracking')

# Read the file
with open(r'components\encoder\encoder-task-processing-modal.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Total lines before: {len(lines)}')

# Remove lines 413-422 (indices 412-421)
new_lines = lines[:412] + lines[422:]

print(f'Total lines after: {len(new_lines)}')
print(f'Removed {len(lines) - len(new_lines)} lines')

# Write back
with open(r'components\encoder\encoder-task-processing-modal.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('File updated successfully!')
print('\nRemoved lines (413-422):')
for i, line in enumerate(lines[412:422], start=413):
    print(f'{i}: {line.rstrip()}')
