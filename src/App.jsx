import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import './App.css';
import SerpChecker from './frontend/components/SerpChecker';
import SerpPreview from './frontend/components/SerpPreview';

function App() {
  const [serpData, setSerpData] = useState(null);

  const handleUpdate = (data) => {
    console.log('SERP data updated:', data);
    setSerpData(data);
  };

  return (
    <div className="App">
      <Container className="mt-4">
        <Row>
          <Col>
            <h1 className="text-center mb-4">SERP Title Checker</h1>
            <SerpChecker onUpdate={handleUpdate} />

            {serpData && <SerpPreview serpData={serpData} />}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
