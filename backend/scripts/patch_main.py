import sys

f = open('app/main.py', 'r', encoding='utf-8')
content = f.read()
f.close()

old_block = '    # Future routers — add here as modules are built:'
new_block = (
    '    app.include_router(allocation_router, prefix="/api")  # Member B Screen 5\n'
    '    app.include_router(transfer_router, prefix="/api")    # Member B Screen 5\n'
    '\n'
    '    # Future routers:\n'
)

if old_block in content:
    # Remove old commented block up to the blank line
    lines = content.split('\n')
    result = []
    skip = False
    inserted = False
    for line in lines:
        if old_block in line and not inserted:
            result.append('    app.include_router(allocation_router, prefix="/api")  # Member B Screen 5')
            result.append('    app.include_router(transfer_router, prefix="/api")    # Member B Screen 5')
            result.append('')
            result.append('    # Future routers:')
            inserted = True
            skip = True
            continue
        if skip and line.strip().startswith('#'):
            continue
        if skip and line.strip() == '':
            skip = False
            continue
        result.append(line)
    open('app/main.py', 'w', encoding='utf-8').write('\n'.join(result))
    print('OK')
else:
    print('Block not found - showing relevant lines:')
    for i, l in enumerate(content.split('\n')):
        if 'router' in l.lower() or 'Future' in l:
            print(f'{i+1}: {repr(l)}')
