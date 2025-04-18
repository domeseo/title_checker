import React, { useEffect, useState } from "react";
import { Form, Button, Alert, Spinner } from "react-bootstrap";
import CryptoJS from "crypto-js";

// Usar directamente la clave en lugar de obtenerla de variables de entorno
const secretPass = "NO_KEY_HARDCODED";

function encryptAPIKey(apiKey) {
    // Usamos un método más simple: Base64 + una capa básica de ofuscación
    const base64Key = btoa(apiKey); // Convertir a Base64
    return base64Key;
}

const SerpChecker = ({ onUpdate }) => {
    const [title, setTitle] = useState("Your SEO Title Here - Up to 60 Characters");
    const [description, setDescription] = useState("Your meta description here. This text will appear in search results and should be attractive and informative. Maximum 155 characters.");
    const [url, setUrl] = useState("https://example.com");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [isMetaExtracted, setIsMetaExtracted] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [userId, setUserId] = useState("");
    const [openai, setOpenai] = useState("");

    const sendApiKey = async () => {
        try {
            if (!openai) {
                setError("Por favor, ingresa tu API key de OpenAI");
                return;
            }

            // Usar la nueva función de encriptación
            const encryptedKey = encryptAPIKey(openai);

            const response = await fetch('http://localhost:5002/set-key', {
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

    // Actualizar la preview en tiempo real cuando cambie title o description
    useEffect(() => {
        if (typeof onUpdate === 'function' && (title || description)) {
            onUpdate({
                title,
                description,
                url
            });
        }
    }, [title, description, url, onUpdate]);

    // Actualizar la preview inmediatamente al cargar la página
    useEffect(() => {
        if (typeof onUpdate === 'function') {
            onUpdate({
                title,
                description,
                url
            });
        }
    }, [onUpdate]);

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
            user_id: userId
        };

        try {
            // Comunicación con el backend
            const response = await fetch('http://localhost:5002/analyze', {
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

            const response = await fetch('http://localhost:5002/extract-meta', {
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
        } catch (err) {
            console.error("Error al obtener data", err);
            setError("No se pudo extraer la información: " + err.message);
            setIsMetaExtracted(false);
        } finally {
            setIsLoading(false);
        }
    }

    const handleUrlSubmit = (e) => {
        setUrl(e.target.value);
        getMetas(e.target.value);
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
                {/*OpenaiKey*/}

                <Form >
                    <Form.Group className="form-group mb-3">
                        <Form.Label>OpenAI Key</Form.Label>
                        <Form.Control type="password" className="form-control" value={openai} onChange={(e) => setOpenai(e.target.value)} />
                    </Form.Group>
                </Form>
                {/* Botón para enviar Openai Key */}
                <Button
                    variant="primary"
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





                {/* Título SEO */}
                <Form.Group className="mb-3">
                    <Form.Label>Title (max. 60 chars.)</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Insert your SEO Title"
                        value={title}
                        maxLength={60}
                        onChange={handleTitleChange}
                    />
                    <Form.Text className="text-muted">{title.length}/60 </Form.Text>
                </Form.Group>

                {/* Meta Descripción */}
                <Form.Group className="mb-3">
                    <Form.Label>Meta Description (max. 155 chars.)</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Insert your meta description"
                        value={description}
                        maxLength={155}
                        onChange={handleDescriptionChange}
                    />
                    <Form.Text className="text-muted">{description.length}/155</Form.Text>
                </Form.Group>

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