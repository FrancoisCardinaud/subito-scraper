let isScrapingActive = false;
let currentPort = null;

// Listen for connections from the popup
chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === "popup") {
    currentPort = port;
    isScrapingActive = true;
    
    // Listen for popup disconnection
    port.onDisconnect.addListener(function() {
      console.log('Popup closed, stopping scraping process');
      isScrapingActive = false;
      currentPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeData') {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      try {
        const tab = tabs[0];
        console.log('Starting scraping process on tab:', tab.url);
        
        const results = await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          func: (message) => {
            async function findButtonByText(text) {
              // Try to find the button by its text content
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(button => button.textContent.trim().toLowerCase() === text.toLowerCase());
            }

            async function sendMessage(messageText) {
              try {
                // Ensure proper UTF-8 encoding
                const encoder = new TextEncoder();
                const decoder = new TextDecoder('utf-8');
                const encodedMessage = decoder.decode(encoder.encode(messageText));

                // Try multiple ways to find the contact button
                let contactButton = document.querySelector('button.AdReplyButtons_contactButton__m79Sm') ||
                                  document.querySelector('button.button-text[class*="contactButton"]') ||
                                  await findButtonByText('contatta');

                if (!contactButton) {
                  throw new Error('Contact button not found');
                }
                contactButton.click();

                // Wait for the text box to appear
                await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced wait time

                // Try multiple ways to find the message input
                const messageInput = document.querySelector('#body') ||
                                   document.querySelector('textarea[placeholder*="messaggio"]') ||
                                   document.querySelector('textarea');
                                   
                if (!messageInput) {
                  throw new Error('Message input not found');
                }
                messageInput.value = encodedMessage;
                
                // Trigger input events to ensure the form recognizes the change
                messageInput.dispatchEvent(new Event('input', { bubbles: true }));
                messageInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Wait a bit for the input event to be processed
                await new Promise(resolve => setTimeout(resolve, 200));

                // Try multiple ways to find the send button
                const sendButton = document.querySelector('#adreply_form_container > form > button') ||
                                 document.querySelector('button[type="submit"]') ||
                                 await findButtonByText('invia');

                if (!sendButton) {
                  throw new Error('Send button not found');
                }
                sendButton.click();

                // Wait for the message to be sent
                await new Promise(resolve => setTimeout(resolve, 500));

                return true;
              } catch (error) {
                console.error('Error sending message:', error);
                return false;
              }
            }

            async function extractAddress(text) {
              // List of Italian address keywords with word boundaries
              const addressKeywords = ['\\bvia\\b', '\\bviale\\b', '\\bpiazza\\b', '\\bcorso\\b', '\\bvicolo\\b', '\\blargo\\b', '\\bstrada\\b'];
              
              // Create a regex pattern that matches any of the keywords
              const pattern = new RegExp(`(${addressKeywords.join('|')})\\s+[A-Za-z\\s]+(?:\\s+\\d+)?`, 'i');
              
              // Find matches in the text
              const match = text.match(pattern);
              
              if (match) {
                let address = match[0].trim();
                
                // Limit the length of the address and ensure it doesn't end mid-word
                const maxLength = 50;
                if (address.length > maxLength) {
                  // Find the last space before maxLength
                  const lastSpace = address.lastIndexOf(' ', maxLength);
                  if (lastSpace !== -1) {
                    address = address.substring(0, lastSpace);
                  }
                }
                
                // Verify it's not part of a longer word or phrase that might not be an address
                const invalidPatterns = [
                  /strada\s+statale/i,
                  /via\s+di\s+comunicazione/i,
                  /viabilità/i,
                  /viaria/i
                ];
                
                for (const invalidPattern of invalidPatterns) {
                  if (invalidPattern.test(address)) {
                    return null;
                  }
                }
                
                return address;
              }
              return null;
            }

            async function getPhoneNumber() {
              // Find and click the phone button
              const phoneButton = document.querySelector('#sticky-cta-container > div > button.button-text.index-module_sbt-button__hQMUx.index-module_outline__reo8F.index-module_large__Zhzux.index-module_icon-only__gkRU8.index-module_slim__yHxIG.PhoneButton_phoneButton__YYFuW');
              if (!phoneButton) {
                return null;
              }

              phoneButton.click();

              // Wait for the popup to appear and get the phone number
              return new Promise((resolve) => {
                // Try to find the phone number element multiple times
                let attempts = 0;
                const maxAttempts = 10;
                
                const checkForPhoneNumber = () => {
                  const phoneElement = document.querySelector('#radix-\\:r6\\: > div > address');
                  if (phoneElement) {
                    resolve(phoneElement.textContent.trim());
                  } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkForPhoneNumber, 200); // Check every 200ms
                  } else {
                    resolve(null); // Give up after max attempts
                  }
                };

                setTimeout(checkForPhoneNumber, 200); // Initial check after 200ms
              });
            }

            async function scrapeSingleListing(message) {
              try {
                console.log('Checking if single listing page...');
                const data = {
                  url: window.location.href,
                  address: '',
                  price: '',
                  rooms: '',
                  surface: '',
                  phone: '',
                  messageStatus: 'Not applicable'
                };

                // Get title
                console.log('Getting title...');
                const titleElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > h1');
                const title = titleElement ? titleElement.textContent.trim() : '';

                // Get description
                console.log('Getting description...');
                const descriptionElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section.grid_detail-component__Q9ihk.grid_description__KrWqU > p.index-module_sbt-text-atom__ifYVU.index-module_token-body__erqqS.size-normal.index-module_weight-book__kP2zY.AdDescription_description__154FP.index-module_preserve-new-lines__ZOcGy');
                const description = descriptionElement ? descriptionElement.textContent.trim() : '';

                // Get price
                console.log('Getting price...');
                const priceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > p');
                if (priceElement) {
                  data.price = priceElement.textContent.trim();
                }

                // Get city
                console.log('Getting city...');
                const cityElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > div.AdInfo_location__cPlpI > p');
                const city = cityElement ? cityElement.textContent.trim() : '';

                // Extract address from title and description
                console.log('Extracting address...');
                const addressFromTitle = await extractAddress(title);
                const addressFromDescription = await extractAddress(description);
                
                // Combine address information
                const streetAddress = addressFromTitle || addressFromDescription || '';
                data.address = streetAddress ? `${streetAddress}, ${city}` : city;

                // Get surface area
                console.log('Getting surface area...');
                const surfaceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(1) > p');
                if (surfaceElement) {
                  data.surface = surfaceElement.textContent.trim();
                }

                // Get number of rooms
                console.log('Getting number of rooms...');
                const roomsElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(2) > p');
                if (roomsElement) {
                  data.rooms = roomsElement.textContent.trim();
                }

                // Check if we should attempt to send a message
                console.log('Checking for contact button...');
                const contactButton = document.querySelector('button.AdReplyButtons_contactButton__m79Sm') ||
                                    document.querySelector('button.button-text[class*="contactButton"]');
                
                if (contactButton) {
                  console.log('Found contact button, attempting to send message...');
                  try {
                    await sendMessage(message);
                    data.messageStatus = 'Message sent successfully';
                  } catch (error) {
                    console.error('Error sending message:', error);
                    data.messageStatus = 'Failed to send message';
                  }
                }

                // Get phone number
                console.log('Getting phone number...');
                data.phone = await getPhoneNumber() || 'Not available';

                console.log('Scraped data:', data);
                return data;
              } catch (error) {
                console.error('Error in scrapeSingleListing:', error);
                return {
                  url: window.location.href,
                  error: error.message,
                  messageStatus: 'Error occurred'
                };
              }
            }

            console.log('Starting scraping process...');
            
            // Check if we're on a search results page by checking URL pattern
            const currentUrl = window.location.href;
            const isSearchResultsPage = !currentUrl.endsWith('.htm');
            
            console.log('Page type:', isSearchResultsPage ? 'Search Results' : 'Single Listing');
            console.log('Current URL:', currentUrl);

            if (isSearchResultsPage) {
              console.log('Processing search results page...');
              // Find all listing links - they should end with a number followed by .htm
              const links = Array.from(document.querySelectorAll('a[href*="subito.it"]'))
                .map(link => link.href)
                .filter(url => {
                  // Check if URL ends with a number followed by .htm
                  const match = url.match(/\d+\.htm$/);
                  // Ensure it's a listing URL (contains /appartamenti/ or similar)
                  const isListing = url.includes('/appartamenti/') || 
                                  url.includes('/case/') || 
                                  url.includes('/ville-singole-e-a-schiera/');
                  return match && isListing;
                });
              
              console.log(`Found ${links.length} listing links:`, links);
              return { type: 'search_results', links: links };
            } else {
              return scrapeSingleListing(message);
            }
          },
          args: [request.message]
        });

        const result = results[0].result;
        
        // Handle search results differently
        if (result && result.type === 'search_results') {
          console.log('Processing batch of links:', result.links);
          const scrapedData = [];
          const totalListings = result.links.length;
          let processedListings = 0;

          // Send initial progress
          if (currentPort) {
            currentPort.postMessage({
              type: 'progress',
              current: processedListings,
              total: totalListings
            });
          }
          
          // Process links in batches of 3
          for (let i = 0; i < result.links.length && isScrapingActive; i += 3) {
            const batch = result.links.slice(i, i + 3);
            console.log(`Processing batch ${Math.floor(i/3) + 1} of ${Math.ceil(result.links.length/3)}`);
            
            try {
              // Process all URLs in the batch simultaneously
              const batchPromises = batch.map(async (url) => {
                if (!isScrapingActive) {
                  return null;
                }

                try {
                  console.log('Opening tab for:', url);
                  const newTab = await chrome.tabs.create({ url, active: false });
                  
                  // Wait for page load
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  
                  if (!isScrapingActive) {
                    await chrome.tabs.remove(newTab.id);
                    return null;
                  }

                  // Execute the scraping in the new tab
                  const scrapeResult = await chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    func: async (message) => {
                      // Include all necessary functions in this context
                      async function extractAddress(text) {
                        // List of Italian address keywords with word boundaries
                        const addressKeywords = ['\\bvia\\b', '\\bviale\\b', '\\bpiazza\\b', '\\bcorso\\b', '\\bvicolo\\b', '\\blargo\\b', '\\bstrada\\b'];
                        
                        // Create a regex pattern that matches any of the keywords
                        const pattern = new RegExp(`(${addressKeywords.join('|')})\\s+[A-Za-z\\s]+(?:\\s+\\d+)?`, 'i');
                        
                        // Find matches in the text
                        const match = text.match(pattern);
                        
                        if (match) {
                          let address = match[0].trim();
                          
                          // Limit the length of the address and ensure it doesn't end mid-word
                          const maxLength = 50;
                          if (address.length > maxLength) {
                            // Find the last space before maxLength
                            const lastSpace = address.lastIndexOf(' ', maxLength);
                            if (lastSpace !== -1) {
                              address = address.substring(0, lastSpace);
                            }
                          }
                          
                          // Verify it's not part of a longer word or phrase that might not be an address
                          const invalidPatterns = [
                            /strada\s+statale/i,
                            /via\s+di\s+comunicazione/i,
                            /viabilità/i,
                            /viaria/i
                          ];
                          
                          for (const invalidPattern of invalidPatterns) {
                            if (invalidPattern.test(address)) {
                              return null;
                            }
                          }
                          
                          return address;
                        }
                        return null;
                      }

                      async function getPhoneNumber() {
                        // Find and click the phone button
                        const phoneButton = document.querySelector('#sticky-cta-container > div > button.button-text.index-module_sbt-button__hQMUx.index-module_outline__reo8F.index-module_large__Zhzux.index-module_icon-only__gkRU8.index-module_slim__yHxIG.PhoneButton_phoneButton__YYFuW');
                        if (!phoneButton) {
                          return null;
                        }

                        phoneButton.click();

                        // Wait for the popup to appear and get the phone number
                        return new Promise((resolve) => {
                          // Try to find the phone number element multiple times
                          let attempts = 0;
                          const maxAttempts = 10;
                          
                          const checkForPhoneNumber = () => {
                            const phoneElement = document.querySelector('#radix-\\:r6\\: > div > address');
                            if (phoneElement) {
                              resolve(phoneElement.textContent.trim());
                            } else if (attempts < maxAttempts) {
                              attempts++;
                              setTimeout(checkForPhoneNumber, 200); // Check every 200ms
                            } else {
                              resolve(null); // Give up after max attempts
                            }
                          };

                          setTimeout(checkForPhoneNumber, 200); // Initial check after 200ms
                        });
                      }

                      async function sendMessage(message) {
                        try {
                          // Ensure proper UTF-8 encoding
                          const encoder = new TextEncoder();
                          const decoder = new TextDecoder('utf-8');
                          const encodedMessage = decoder.decode(encoder.encode(message));

                          // Try multiple ways to find the contact button
                          let contactButton = document.querySelector('button.AdReplyButtons_contactButton__m79Sm') ||
                                            document.querySelector('button.button-text[class*="contactButton"]');
                          
                          if (!contactButton) {
                            throw new Error('Contact button not found');
                          }
                          contactButton.click();

                          // Wait for the text box to appear
                          await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced wait time

                          // Try multiple ways to find the message input
                          const messageInput = document.querySelector('#body') ||
                                             document.querySelector('textarea[placeholder*="messaggio"]') ||
                                             document.querySelector('textarea');
                                             
                          if (!messageInput) {
                            throw new Error('Message input not found');
                          }
                          messageInput.value = encodedMessage;
                          
                          // Trigger input events to ensure the form recognizes the change
                          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
                          messageInput.dispatchEvent(new Event('change', { bubbles: true }));

                          // Wait a bit for the input event to be processed
                          await new Promise(resolve => setTimeout(resolve, 200));

                          // Try multiple ways to find the send button
                          const sendButton = document.querySelector('#adreply_form_container > form > button') ||
                                           document.querySelector('button[type="submit"]') ||
                                           await findButtonByText('invia');

                          if (!sendButton) {
                            throw new Error('Send button not found');
                          }
                          sendButton.click();

                          // Wait for the message to be sent
                          await new Promise(resolve => setTimeout(resolve, 500));

                          return true;
                        } catch (error) {
                          console.error('Error sending message:', error);
                          return false;
                        }
                      }

                      async function scrapeSingleListing(message) {
                        try {
                          console.log('Checking if single listing page...');
                          const data = {
                            url: window.location.href,
                            address: '',
                            price: '',
                            rooms: '',
                            surface: '',
                            phone: '',
                            messageStatus: 'Not applicable'
                          };

                          // Get title
                          console.log('Getting title...');
                          const titleElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > h1');
                          const title = titleElement ? titleElement.textContent.trim() : '';

                          // Get description
                          console.log('Getting description...');
                          const descriptionElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section.grid_detail-component__Q9ihk.grid_description__KrWqU > p.index-module_sbt-text-atom__ifYVU.index-module_token-body__erqqS.size-normal.index-module_weight-book__kP2zY.AdDescription_description__154FP.index-module_preserve-new-lines__ZOcGy');
                          const description = descriptionElement ? descriptionElement.textContent.trim() : '';

                          // Get price
                          console.log('Getting price...');
                          const priceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > p');
                          if (priceElement) {
                            data.price = priceElement.textContent.trim();
                          }

                          // Get city
                          console.log('Getting city...');
                          const cityElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > div.AdInfo_location__cPlpI > p');
                          const city = cityElement ? cityElement.textContent.trim() : '';

                          // Extract address from title and description
                          console.log('Extracting address...');
                          const addressFromTitle = await extractAddress(title);
                          const addressFromDescription = await extractAddress(description);
                          
                          // Combine address information
                          const streetAddress = addressFromTitle || addressFromDescription || '';
                          data.address = streetAddress ? `${streetAddress}, ${city}` : city;

                          // Get surface area
                          console.log('Getting surface area...');
                          const surfaceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(1) > p');
                          if (surfaceElement) {
                            data.surface = surfaceElement.textContent.trim();
                          }

                          // Get number of rooms
                          console.log('Getting number of rooms...');
                          const roomsElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(2) > p');
                          if (roomsElement) {
                            data.rooms = roomsElement.textContent.trim();
                          }

                          // Check if we should attempt to send a message
                          console.log('Checking for contact button...');
                          const contactButton = document.querySelector('button.AdReplyButtons_contactButton__m79Sm') ||
                                            document.querySelector('button.button-text[class*="contactButton"]');
                          
                          if (contactButton) {
                            console.log('Found contact button, attempting to send message...');
                            try {
                              await sendMessage(message);
                              data.messageStatus = 'Message sent successfully';
                            } catch (error) {
                              console.error('Error sending message:', error);
                              data.messageStatus = 'Failed to send message';
                            }
                          }

                          // Get phone number
                          console.log('Getting phone number...');
                          data.phone = await getPhoneNumber() || 'Not available';

                          console.log('Scraped data:', data);
                          return data;
                        } catch (error) {
                          console.error('Error in scrapeSingleListing:', error);
                          return {
                            url: window.location.href,
                            error: error.message,
                            messageStatus: 'Error occurred'
                          };
                        }
                      }

                      return await scrapeSingleListing(message);
                    },
                    args: [request.message]
                  });
                  
                  // Close the tab
                  await chrome.tabs.remove(newTab.id);
                  
                  // Increment processed count and update progress
                  processedListings++;
                  if (currentPort) {
                    currentPort.postMessage({
                      type: 'progress',
                      current: processedListings,
                      total: totalListings
                    });
                  }
                  
                  return scrapeResult && scrapeResult[0].result;
                } catch (error) {
                  console.error('Error processing listing:', url, error);
                  // Still increment processed count even on error
                  processedListings++;
                  if (currentPort) {
                    currentPort.postMessage({
                      type: 'progress',
                      current: processedListings,
                      total: totalListings
                    });
                  }
                  return {
                    url,
                    error: error.message,
                    messageStatus: 'Error occurred'
                  };
                }
              });

              // Wait for all tabs in the batch to complete
              const batchResults = await Promise.all(batchPromises);
              
              // Add successful results to scrapedData
              scrapedData.push(...batchResults.filter(result => result !== null));

              if (!isScrapingActive) {
                console.log('Scraping stopped by user');
                break;
              }

              // Small delay between batches
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error('Error processing batch:', error);
            }
          }
          
          // Only save data if we have any and scraping wasn't stopped
          if (scrapedData.length > 0) {
            try {
              // Create header row
              const headers = ['URL', 'Address', 'Price', 'Rooms', 'Surface', 'Phone', 'Message Status'].join('\t');
              
              // Format data rows
              const dataRows = scrapedData.map(d => [
                d.url || '',
                d.address || '',
                d.price || '',
                d.rooms || '',
                d.surface || '',
                d.phone || '',
                d.messageStatus || ''
              ].join('\t'));
              
              // Combine headers and data
              const textData = [headers, ...dataRows].join('\n');
              
              // Convert to base64
              const base64Data = btoa(unescape(encodeURIComponent(textData)));
              const dataUrl = `data:text/plain;base64,${base64Data}`;
              
              // Download the file
              const filename = `subito_listings_${new Date().toISOString().slice(0,10)}.txt`;
              console.log('Initiating download...');
              
              chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: true,
                conflictAction: 'uniquify'
              }, (downloadId) => {
                console.log('Download initiated with ID:', downloadId);
                if (chrome.runtime.lastError) {
                  console.error('Download error:', chrome.runtime.lastError);
                }
                
                // Notify popup of completion regardless of download status
                if (currentPort) {
                  currentPort.postMessage({
                    type: 'complete',
                    total: processedListings,
                    downloadStarted: downloadId ? true : false
                  });
                }
              });
              
              console.log('Download request sent');
              
            } catch (error) {
              console.error('Error saving data:', error);
              if (currentPort) {
                currentPort.postMessage({
                  type: 'complete',
                  total: processedListings,
                  error: error.message
                });
              }
            }
          } else {
            if (currentPort) {
              currentPort.postMessage({
                type: 'complete',
                total: processedListings,
                noData: true
              });
            }
          }
          
          // Send response and return true to indicate we'll send response asynchronously
          sendResponse({
            completed: true,
            total: processedListings
          });
          return true;
        } else {
          // Single listing result
          console.log('Single listing result:', result);
          if (result.error) {
            sendResponse({
              error: result.error,
              completed: false
            });
          } else {
            sendResponse({
              ...result,
              completed: false
            });
          }
          return true;
        }
      } catch (error) {
        console.error('Error in main process:', error);
        sendResponse({error: error.message});
      }
    });
    return true;  // Will respond asynchronously
  }
});
