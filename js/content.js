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

async function getNextPageButton() {
  // The main selector for the next button
  const nextButton = document.querySelector('#layout > main > div:nth-child(2) > div.ListingContainer_layout__paU6c > div > div.ListingContainer_container__Eh3S3 > div.ListingContainer_col__BgYy2.ListingContainer_items__na8UR.col.items > nav > button:nth-child(6)');
  
  if (nextButton && !nextButton.disabled && nextButton.style.display !== 'none') {
    return nextButton;
  }
  return null;
}

async function collectSearchResults() {
  try {
    // Wait for listings to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Collect all listing links
    const listingLinks = Array.from(document.querySelectorAll('a[href*="/annuncio/"]'))
      .map(a => a.href)
      .filter(url => /\d+\.htm$/.test(url));

    // Get unique links only
    const uniqueLinks = [...new Set(listingLinks)];
    
    // Check if there's a next page
    const nextButton = await getNextPageButton();
    const hasNextPage = nextButton !== null;

    console.log('Found next button:', hasNextPage ? 'yes' : 'no');
    if (hasNextPage) {
      console.log('Next button text:', nextButton.textContent);
      console.log('Next button disabled:', nextButton.disabled);
      console.log('Next button display:', nextButton.style.display);
    }

    return {
      type: 'search_results',
      links: uniqueLinks,
      hasNextPage
    };
  } catch (error) {
    console.error('Error collecting search results:', error);
    return {
      type: 'error',
      error: error.message
    };
  }
}

async function scrapeSingleListing() {
  try {
    // Wait for listing to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Scrape listing data
    const data = scrapeData();
    
    return {
      type: 'listing',
      data
    };
  } catch (error) {
    console.error('Error scraping single listing:', error);
    return {
      type: 'error',
      error: error.message
    };
  }
}

// Export the main function that will be called by the background script
window.scrapeData = async function() {
  const url = window.location.href;
  
  // Check if this is a search results page or a single listing
  if (url.includes('/annunci/')) {
    return await collectSearchResults();
  } else if (url.includes('/annuncio/')) {
    return await scrapeSingleListing();
  } else {
    return {
      type: 'error',
      error: 'Not a valid Subito.it page'
    };
  }
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeData') {
        window.scrapeData().then(data => sendResponse(data));
    }
    return true;
});
