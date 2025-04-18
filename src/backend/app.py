from api.routes import app
from flask_session import Session

if __name__ == '__main__':
    # Inicializar el manejo de sesiones
    Session(app)
    print("Iniciando servidor Flask...")
    print("API disponible en http://localhost:5002")
    app.run(debug=True, host='0.0.0.0', port=5002)
