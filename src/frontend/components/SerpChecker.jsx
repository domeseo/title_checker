import React, { useEffect, useState } from "react";
import { Form, Button, Alert, Spinner } from "react-bootstrap";
import CryptoJS from "crypto-js";

// Obtener la clave desde las variables de entorno, nunca hardcodeada
const secretPass = process.env.REACT_APP_ENCRYPTION_KEY || "";

// Obtener la URL base de la API desde las variables de entorno
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function encryptAPIKey(apiKey) {
    // Usamos un método más simple: Base64 + una capa básica de ofuscación
    const base64Key = btoa(apiKey); // Convertir a Base64
    return base64Key;
}

const SerpChecker = ({ onUpdate }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [url, setUrl] = useState("https://example.com");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [isMetaExtracted, setIsMetaExtracted] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [userId, setUserId] = useState("");
    const [openai, setOpenai] = useState("");
    const [keyword, setKeyword] = useState("");
    const [brand, setBrand] = useState("");
    const [previewData, setPreviewData] = useState({
        title: "",
        description: "",
        url: "https://example.com"
    });

    const handleKeywordChange = (e) => {
        setKeyword(e.target.value);
    };

    const handleBrandChange = (e) => {
        setBrand(e.target.value);
    }

    // Función para actualizar la previsualización
    const updatePreview = () => {
        if (typeof onUpdate === 'function') {
            const data = {
                title,
                description,
                url
            };
            setPreviewData(data);
            onUpdate(data);
        }
    };

    // Botón para actualizar la previsualización manualmente
    const handlePreviewUpdate = () => {
        updatePreview();
    };

    // Actualizar la previsualización inmediatamente al cargar la página
    useEffect(() => {
        updatePreview();
    }, []);

    const sendApiKey = async () => {
        try {
            if (!openai) {
                setError("Por favor, ingresa tu API key de OpenAI");
                return;
            }

            // Usar la nueva función de encriptación
            const encryptedKey = encryptAPIKey(openai);

            const response = await fetch(`${API_URL}/set-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    encryptedKey: encryptedKey
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert("API key configurada con éxito");
            } else {
                throw new Error(data.message || "Error al configurar la API key");
            }
        } catch (err) {
            console.error("Error:", err);
            setError("Error al configurar la API key: " + err.message);
        }
    };

    // Generar o recuperar ID de usuario si no existe
    useEffect(() => {
        // Intentar recuperar el ID de usuario del almacenamiento local
        let storedUserId = localStorage.getItem('serp_user_id');

        // Si no existe, crear uno nuevo basado en timestamp y número aleatorio
        if (!storedUserId) {
            storedUserId = `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            localStorage.setItem('serp_user_id', storedUserId);
        }

        setUserId(storedUserId);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError("");
        setAnalysis(null);

        // Datos para enviar al servidor
        const serpData = {
            title,
            description,
            url,
            keyword,
            brand,
            user_id: userId
        };

        try {
            // Comunicación con el backend
            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(serpData)
            });

            const data = await response.json();
            console.log('Respuesta del servidor:', data);

            if (!response.ok) {
                // Manejar el error de límite excedido (código 429)
                if (response.status === 429) {
                    throw new Error(data.message || 'Has alcanzado el límite diario de uso');
                } else {
                    throw new Error(data.message || 'Error desconocido');
                }
            }

            if (data.status === 'success') {
                setAnalysis(data.data.analysis);
            } else {
                throw new Error(data.message || 'Error desconocido');
            }
        } catch (err) {
            console.error("Error:", err);
            setError("Ocurrió un error al procesar la solicitud: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getMetas = async (url) => {
        try {
            setIsLoading(true);

            const response = await fetch(`${API_URL}/extract-meta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    url,
                    user_id: userId
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Manejar el error de límite excedido (código 429)
                if (response.status === 429) {
                    throw new Error(data.message || 'Has alcanzado el límite diario de extracciones');
                } else {
                    throw new Error(data.message || "Error during the process");
                }
            }

            // Guardar los metadatos pero no mostrarlos visualmente
            if (data.metadata) {
                setMetadata(data.metadata);

                // Usar el título que viene del servidor
                setTitle(data.title);

                // Usar la meta descripción que viene del servidor
                setDescription(data.meta_description);
            }

            setIsMetaExtracted(true);

            // Actualizar la previsualización después de obtener los metadatos
            setTimeout(updatePreview, 100); // Pequeño retraso para asegurar que los estados se han actualizado
        } catch (err) {
            console.error("Error al obtener data", err);
            setError("No se pudo extraer la información: " + err.message);
            setIsMetaExtracted(false);
        } finally {
            setIsLoading(false);
        }
    }

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
    };

    const handleDescriptionChange = (e) => {
        setDescription(e.target.value);
    };

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}

            {/* Un solo formulario para todo */}
            <Form onSubmit={handleSubmit}>

                <div className="container">
                    <div className="row">
                        <div className="col-sm openkeybox">
                            <Form >
                                <Form.Group className="form-group mb-3">
                                    <Form.Label>OpenAI Key</Form.Label>
                                    <Form.Control type="password" className="form-control" required value={openai} onChange={(e) => setOpenai(e.target.value)} />
                                </Form.Group>
                            </Form>
                            {/* Botón para enviar Openai Key */}
                            <Button
                                variant="danger"
                                type="button"
                                disabled={isLoading || !openai}
                                onClick={sendApiKey}
                                className="mb-4"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner
                                            as="span"
                                            animation="border"
                                            size="sm"
                                            role="status"
                                            aria-hidden="true"
                                            className="me-2"
                                        />
                                        Working...
                                    </>
                                ) : (
                                    "Set your Key"
                                )}
                            </Button>

                        </div>
                        <div className="col-sm urlmeta">
                            {/* Campo para URL */}
                            <Form.Group className="mb-3">
                                <Form.Label>URL</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </Form.Group>
                            {/* Botón para obtener metadatos */}
                            <Button
                                variant="primary"
                                type="button"
                                disabled={isLoading}
                                onClick={() => getMetas(url)}
                                className="mb-4"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner
                                            as="span"
                                            animation="border"
                                            size="sm"
                                            role="status"
                                            aria-hidden="true"
                                            className="me-2"
                                        />
                                        Working...
                                    </>
                                ) : (
                                    "Get Metadata"
                                )}
                            </Button>

                        </div>
                    </div>
                </div>
                <div className="container">
                    <div className="row">
                        <div className="col-sm keyword">{/* Keyword */}
                            <Form.Group className="mb-4">
                                <Form.Label>Focus Keyword</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Insert your focus keyword"
                                    value={keyword}
                                    onChange={handleKeywordChange}
                                />
                            </Form.Group></div>
                        <div className="col-sm brand"><Form.Group className="mb-4">
                            <Form.Label>Brand</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Insert your Brand"
                                value={brand}
                                onChange={handleBrandChange}
                            />
                        </Form.Group></div>
                    </div>
                </div>

                {/* SEO Title */}
                <Form.Group className="mb-3">
                    <Form.Label>Title (max. 60 chars.)</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Insert your SEO Title"
                        value={title}
                        maxLength={60}
                        onChange={handleTitleChange}
                        required
                    />
                    <Form.Text className="text-muted">{title.length}/60 </Form.Text>
                </Form.Group>

                {/* Meta Description */}
                <Form.Group className="mb-3">
                    <Form.Label>Meta Description (max. 155 chars.)</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Insert your meta description"
                        value={description}
                        maxLength={155}
                        onChange={handleDescriptionChange}
                        required
                    />
                    <Form.Text className="text-muted">{description.length}/155</Form.Text>
                </Form.Group>

                {/* Botón para actualizar la previsualización */}
                <Button
                    variant="secondary"
                    type="button"
                    onClick={handlePreviewUpdate}
                    className="mb-4 me-2"
                >
                    Actualizar Previsualización
                </Button>

                {/* Botón para enviar el formulario */}
                <Button
                    variant="primary"
                    type="submit"
                    disabled={isLoading || !title || !description} // Deshabilitar solo si no hay título o descripción
                    className="mb-4"
                >
                    {isLoading ? (
                        <>
                            <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                            />
                            Working for you...
                        </>
                    ) : (
                        "Meta Analysis"
                    )}
                </Button>
            </Form>

            {/* Mostrar los resultados del análisis */}
            {analysis && (
                <div className="mt-4 p-3 border rounded bg-light">
                    <h3>Results</h3>
                    <pre className="analysis-result">{analysis}</pre>
                    <Button
                        variant="primary"
                        type="button"
                        onClick={() => {
                            setAnalysis(null);
                        }}
                        className="mb-4">New Analysis</Button>
                </div>
            )}
        </>
    );
};

export default SerpChecker;