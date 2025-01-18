function scrapeData() {
    const data = {
        url: window.location.href,
        address: '',
        price: '',
        rooms: '',
        surface: ''
    };

    try {
        // Get price
        const priceElement = document.querySelector('[class*="price"]');
        if (priceElement) {
            data.price = priceElement.textContent.trim();
        }

        // Get address - this will need to be adjusted based on the actual HTML structure
        const addressElement = document.querySelector('[data-testid="location"]');
        if (addressElement) {
            data.address = addressElement.textContent.trim();
        }

        // Get rooms and surface area from the features list
        const features = document.querySelectorAll('[class*="feature-list"] span');
        features.forEach(feature => {
            const text = feature.textContent.toLowerCase();
            if (text.includes('local') || text.includes('vani')) {
                data.rooms = text.trim();
            }
            if (text.includes('m²')) {
                data.surface = text.trim();
            }
        });
    } catch (error) {
        console.error('Error scraping data:', error);
    }

    return data;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeData') {
        const data = scrapeData();
        sendResponse(data);
    }
    return true;
});
