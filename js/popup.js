document.addEventListener('DOMContentLoaded', function() {
    const scrapeButton = document.getElementById('scrapeButton');
    const resultDiv = document.getElementById('result');
    const messageInput = document.getElementById('messageInput');
    const statusDiv = document.getElementById('status');

    // Connect to the background script
    const port = chrome.runtime.connect({ name: "popup" });

    scrapeButton.addEventListener('click', function() {
        const message = messageInput.value;
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('subito.it')) {
                alert('Please navigate to a Subito.it page first!');
                return;
            }

            // Show loading state
            scrapeButton.textContent = 'Sending message & scraping...';
            scrapeButton.disabled = true;
            statusDiv.textContent = 'Sending message and collecting data...';
            statusDiv.style.display = 'block';

            // Send message to background script
            chrome.runtime.sendMessage({ 
                action: 'scrapeData',
                message: message 
            }, (response) => {
                // Reset button state
                scrapeButton.textContent = 'Send Message & Scrape Data';
                scrapeButton.disabled = false;
                statusDiv.style.display = 'none';

                if (response.error) {
                    alert('Error: ' + response.error);
                    return;
                }

                // Display the scraped data
                document.getElementById('messageStatus').textContent = response.messageStatus;
                document.getElementById('url').textContent = response.url || 'Not found';
                document.getElementById('address').textContent = response.address || 'Not found';
                document.getElementById('price').textContent = response.price || 'Not found';
                document.getElementById('rooms').textContent = response.rooms || 'Not found';
                document.getElementById('surface').textContent = response.surface || 'Not found';
                document.getElementById('phone').textContent = response.phone || 'Not found';

                // Show the result div
                resultDiv.style.display = 'block';
            });
        });
    });
});
