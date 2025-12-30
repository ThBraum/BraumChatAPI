FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV POETRY_VIRTUALENVS_CREATE=false
ENV POETRY_NO_INTERACTION=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    curl \
    git \
    postgresql-client \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry==2.1.4

WORKDIR /app

COPY pyproject.toml poetry.lock* /app/

RUN poetry install --without dev --no-root

COPY . /app

COPY scripts/wait-for-db-and-migrate.sh /usr/local/bin/wait-for-db-and-migrate.sh
RUN chmod +x /usr/local/bin/wait-for-db-and-migrate.sh

EXPOSE 8000

ENTRYPOINT ["bash", "scripts/wait-for-db-and-migrate.sh"]
CMD ["uvicorn", "braumchat_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
