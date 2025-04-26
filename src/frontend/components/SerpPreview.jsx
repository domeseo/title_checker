import React from "react";

const SerpPreview = ({ serpData }) => {
    if (!serpData) return null;

    // Formatear URL para la visualización
    const displayUrl = serpData.url && serpData.url.replace(/^https?:\/\//, '');

    return (
        <div className="mt-4 p-3 border rounded">
            <h3>Preview:</h3>
            <p>Your preview will appear here after extracting metadata</p>
            <div className="serp-preview">
                <div className="serp-title">{serpData.title || 'Títle not available'}</div>
                <div className="serp-url">{displayUrl || 'URL not available'}</div>
                <div className="serp-description">{serpData.description || 'Description not available'}</div>
            </div>
        </div>
    );
};

export default SerpPreview;
