from api.routes import app

if __name__ == '__main__':
    print("Iniciando servidor Flask...")
    print("API disponible en http://localhost:5002")
    app.run(debug=True, host='0.0.0.0', port=5002)
