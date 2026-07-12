"""Adds users router to main.py"""
content = open('app/main.py', 'r', encoding='utf-8').read()

# Add import
if 'users.router' not in content:
    content = content.replace(
        'from app.modules.allocation.router import router as allocation_router, transfer_router',
        'from app.modules.allocation.router import router as allocation_router, transfer_router\nfrom app.modules.users.router import router as users_router'
    )

# Add registration after transfer_router
if 'users_router' not in content:
    content = content.replace(
        '    app.include_router(transfer_router, prefix="/api")    # Member B Screen 5',
        '    app.include_router(transfer_router, prefix="/api")    # Member B Screen 5\n    app.include_router(users_router, prefix="/api")           # user picker dropdown'
    )

open('app/main.py', 'w', encoding='utf-8').write(content)
print('Done')
