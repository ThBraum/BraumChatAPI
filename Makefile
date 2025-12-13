start:
	docker-compose up --build

stop:
	docker-compose down

stop-clean:
	docker-compose down --volumes

start-fresh:
	docker-compose down --remove-orphans
	docker-compose up --build

logs:
	docker-compose logs -f
