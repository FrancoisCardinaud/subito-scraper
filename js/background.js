chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeData') {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      try {
        const tab = tabs[0];
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
                await new Promise(resolve => setTimeout(resolve, 500)); // Increased wait time

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

            function extractAddress(text) {
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

            const data = {
              url: window.location.href,
              address: '',
              price: '',
              rooms: '',
              surface: '',
              phone: '',
              messageStatus: 'Not sent'
            };

            return new Promise(async (resolve) => {
              try {
                // First, try to send the message
                const messageSent = await sendMessage(message);
                data.messageStatus = messageSent ? 'Message sent successfully' : 'Failed to send message';

                // Get title
                const titleElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > h1');
                const title = titleElement ? titleElement.textContent.trim() : '';

                // Get description
                const descriptionElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section.grid_detail-component__Q9ihk.grid_description__KrWqU > p.index-module_sbt-text-atom__ifYVU.index-module_token-body__erqqS.size-normal.index-module_weight-book__kP2zY.AdDescription_description__154FP.index-module_preserve-new-lines__ZOcGy');
                const description = descriptionElement ? descriptionElement.textContent.trim() : '';

                // Get price
                const priceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > p');
                if (priceElement) {
                  data.price = priceElement.textContent.trim();
                }

                // Get city
                const cityElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > div.grid_detail-component__Q9ihk.grid_right-container__FUFmP > section > div.general-info_ad-info__8rDpS > div.AdInfo_location__cPlpI > p');
                const city = cityElement ? cityElement.textContent.trim() : '';

                // Extract address from title and description
                const addressFromTitle = extractAddress(title);
                const addressFromDescription = extractAddress(description);
                
                // Combine address information
                const streetAddress = addressFromTitle || addressFromDescription || '';
                data.address = streetAddress ? `${streetAddress}, ${city}` : city;

                // Get surface area
                const surfaceElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(1) > p');
                if (surfaceElement) {
                  data.surface = surfaceElement.textContent.trim();
                }

                // Get number of rooms
                const roomsElement = document.querySelector('#layout > main > div.SkeletonWithAdv_skeleton__yPdNQ > div > div.container_outer-ad-container__carpF > div.container_inner-ad-container__jkoED.grid_detail-container__uSre9 > section:nth-child(4) > div > div:nth-child(2) > p');
                if (roomsElement) {
                  data.rooms = roomsElement.textContent.trim();
                }

                // Get phone number
                data.phone = await getPhoneNumber() || 'Not available';

                console.log('Scraped data:', data);
                resolve(data);
              } catch (error) {
                console.error('Error scraping data:', error);
                resolve(data);
              }
            });
          },
          args: [request.message]
        });
        sendResponse(results[0].result);
      } catch (error) {
        console.error('Error:', error);
        sendResponse({error: error.message});
      }
    });
    return true;  // Will respond asynchronously
  }
});
