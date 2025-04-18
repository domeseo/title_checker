import React, { useEffect, useState } from "react";
import { Form, Button, Alert, Spinner } from "react-bootstrap";
import CryptoJS from "crypto-js";

// Get the key from environment variables, never hardcoded
const secretPass = process.env.REACT_APP_ENCRYPTION_KEY || "";

// Get the API base URL from environment variables
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function encryptAPIKey(apiKey) {
    // We use a simpler method: Base64 + a basic layer of obfuscation
    const base64Key = btoa(apiKey); // Convert to Base64
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

    // Function to update the preview
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

    // Button to manually update the preview
    const handlePreviewUpdate = () => {
        updatePreview();
    };

    // Update the preview immediately when the page loads
    useEffect(() => {
        updatePreview();
    }, []);

    const sendApiKey = async () => {
        try {
            if (!openai) {
                setError("Please enter your OpenAI API key");
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
                alert("API key configured successfully");
            } else {
                throw new Error(data.message || "Error configuring API key");
            }
        } catch (err) {
            console.error("Error:", err);
            setError("Error configuring API key: " + err.message);
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

        // Data to send to the server
        const serpData = {
            title,
            description,
            url,
            keyword,
            brand,
            user_id: userId
        };

        try {
            // Communication with the backend
            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(serpData)
            });

            const data = await response.json();
            console.log('Server response:', data);

            if (!response.ok) {
                // Handle the exceeded limit error (code 429)
                if (response.status === 429) {
                    throw new Error(data.message || 'You have reached the daily usage limit');
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            }

            if (data.status === 'success') {
                setAnalysis(data.data.analysis);
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (err) {
            console.error("Error:", err);
            setError("An error occurred while processing the request: " + err.message);
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
                    throw new Error(data.message || 'You have reached the daily extraction limit');
                } else {
                    throw new Error(data.message || "Error during the process");
                }
            }

            // Save the metadata but don't display them visually
            if (data.metadata) {
                setMetadata(data.metadata);

                // Use the title from the server
                setTitle(data.title);

                // Use the meta description from the server
                setDescription(data.meta_description);
            }

            setIsMetaExtracted(true);

            // Update the preview after getting the metadata
            setTimeout(updatePreview, 100); // Small delay to ensure states have been updated
        } catch (err) {
            console.error("Error getting data", err);
            setError("Could not extract information: " + err.message);
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

            {/* A single form for everything */}
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
                            {/* Button to send OpenAI Key */}
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
                            {/* URL field */}
                            <Form.Group className="mb-3">
                                <Form.Label>URL</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </Form.Group>
                            {/* Button to get metadata */}
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

                {/* Button to update preview */}
                <Button
                    variant="secondary"
                    type="button"
                    onClick={handlePreviewUpdate}
                    className="mb-4 me-2"
                >
                    Update Preview
                </Button>

                {/* Button to submit the form */}
                <Button
                    variant="primary"
                    type="submit"
                    disabled={isLoading || !title || !description} // Disable only if there is no title or description
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

            {/* Show analysis results */}
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