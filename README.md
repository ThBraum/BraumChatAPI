
#### Don't forget to import tables at braumchat/models/__init__.py
```bash
docker compose exec -T api alembic revision -m "revision_name"

docker compose exec -T api alembic upgrade head

docker compose exec -T api alembic downgrade -1
```

```bash
Downgrade specific version
docker compose exec -T api alembic downgrade 0b9f4f0f6b4a
```
