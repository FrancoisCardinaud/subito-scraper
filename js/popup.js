document.addEventListener('DOMContentLoaded', function() {
    const scrapeButton = document.getElementById('scrapeButton');
    const messageInput = document.getElementById('messageInput');
    const statusDiv = document.getElementById('status');
    const progressDiv = document.createElement('div');
    const resultDiv = document.getElementById('result');
    progressDiv.id = 'progress';
    progressDiv.style.display = 'none';
    statusDiv.parentNode.insertBefore(progressDiv, statusDiv.nextSibling);

    // Connect to the background script
    const port = chrome.runtime.connect({ name: "popup" });

    // Listen for progress updates from background script
    port.onMessage.addListener(function(msg) {
        console.log('Received message:', msg);
        if (msg.type === 'progress') {
            progressDiv.style.display = 'block';
            progressDiv.textContent = `Page ${msg.page}: Processing ${msg.current} of ${msg.total} listings (${Math.round(msg.current/msg.total*100)}%)`;
        } else if (msg.type === 'new_page') {
            statusDiv.textContent = `Moving to page ${msg.page}...`;
        } else if (msg.type === 'complete') {
            progressDiv.style.display = 'none';
            if (msg.error) {
                statusDiv.textContent = `Error: ${msg.error}`;
            } else if (msg.noData) {
                statusDiv.textContent = 'No listings were found to process.';
            } else {
                if (msg.downloadStarted) {
                    statusDiv.textContent = `Scraping completed! Processed ${msg.total} listings across ${msg.pages} pages. Download should start automatically.`;
                } else {
                    statusDiv.textContent = `Scraping completed! Processed ${msg.total} listings across ${msg.pages} pages, but there was an issue starting the download.`;
                }
            }
            scrapeButton.disabled = false;
        }
    });

    // Handle port disconnection
    port.onDisconnect.addListener(function() {
        console.log('Port disconnected');
        scrapeButton.disabled = false;
        statusDiv.textContent = 'Connection lost. Please try again.';
    });

    scrapeButton.addEventListener('click', function() {
        const message = messageInput.value;
        
        // Check if we're on a Subito.it page
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('subito.it')) {
                statusDiv.textContent = 'Please navigate to a Subito.it page first!';
                statusDiv.style.display = 'block';
                return;
            }
            
            // Reset UI
            progressDiv.style.display = 'none';
            resultDiv.style.display = 'none';
            scrapeButton.disabled = true;
            statusDiv.textContent = 'Starting scraping process...';
            statusDiv.style.display = 'block';

            // Send message to background script
            chrome.runtime.sendMessage({ 
                action: 'scrapeData',
                message: message 
            }, function(response) {
                if (response && !response.completed) {
                    // Single listing result
                    scrapeButton.disabled = false;
                    statusDiv.style.display = 'none';
                    
                    if (response.error) {
                        statusDiv.textContent = 'Error: ' + response.error;
                        statusDiv.style.display = 'block';
                        return;
                    }

                    // Display the scraped data
                    document.getElementById('messageStatus').textContent = response.messageStatus || 'N/A';
                    document.getElementById('url').textContent = response.url || 'Not found';
                    document.getElementById('address').textContent = response.address || 'Not found';
                    document.getElementById('price').textContent = response.price || 'Not found';
                    document.getElementById('rooms').textContent = response.rooms || 'Not found';
                    document.getElementById('surface').textContent = response.surface || 'Not found';
                    document.getElementById('phone').textContent = response.phone || 'Not found';

                    // Show the result div
                    resultDiv.style.display = 'block';
                }
            });
        });
    });
});
