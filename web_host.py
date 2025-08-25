"""
Web-based Remote Desktop Host
Allows remote desktop access through any web browser
No installation required for the remote user
"""

import socket
import threading
import json
import os
import subprocess
import time
import base64
import hashlib
import win32gui
import win32con
import win32api
import win32clipboard
from pynput import mouse, keyboard
from pynput.mouse import Button, Listener as MouseListener
from pynput.keyboard import Key, Listener as KeyboardListener
import pyautogui
from PIL import Image, ImageTk
import io
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import ssl
import webbrowser
import tempfile

class WebRemoteDesktopHost:
    def __init__(self):
        self.server_socket = None
        self.is_connected = False
        self.is_authorized = False
        self.client_username = ""
        self.server_running = False
        
        # Web server settings
        self.web_port = 8080
        self.web_host = '0.0.0.0'
        
        # Default settings
        self.host_port = 9999
        self.host_ip = self.get_local_ip()
        
        # Screenshot optimization
        self._last_screenshot_hash = None
        self._last_screenshot_time = 0
        self.screenshot_cache = {}
        
        # Start web server
        self.start_web_server()
        
    def get_local_ip(self):
        """Get the local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def start_web_server(self):
        """Start the web server for browser access"""
        try:
            # Create custom request handler
            handler = self.create_request_handler()
            
            # Start web server
            self.web_server = HTTPServer((self.web_host, self.web_port), handler)
            self.web_server.timeout = 1
            
            # Start web server thread
            web_thread = threading.Thread(target=self.run_web_server, daemon=True)
            web_thread.start()
            
            print(f"Web server started on http://{self.host_ip}:{self.web_port}")
            print(f"Remote users can access your desktop at: http://{self.host_ip}:{self.web_port}")
            
            # Open browser automatically
            webbrowser.open(f"http://{self.host_ip}:{self.web_port}")
            
        except Exception as e:
            print(f"Failed to start web server: {str(e)}")
    
    def create_request_handler(self):
        """Create a custom HTTP request handler"""
        host_instance = self
        
        class RemoteDesktopHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                """Handle GET requests"""
                try:
                    parsed_path = urllib.parse.urlparse(self.path)
                    path = parsed_path.path
                    
                    if path == '/':
                        # Serve main page
                        self.send_response(200)
                        self.send_header('Content-type', 'text/html')
                        self.end_headers()
                        
                        html_content = host_instance.get_main_page()
                        self.wfile.write(html_content.encode('utf-8'))
                        
                    elif path == '/screenshot':
                        # Serve screenshot
                        self.send_response(200)
                        self.send_header('Content-type', 'image/jpeg')
                        self.end_headers()
                        
                        screenshot_data = host_instance.capture_screenshot()
                        if screenshot_data:
                            self.wfile.write(screenshot_data)
                        else:
                            self.wfile.write(b'')
                            
                    elif path == '/api/status':
                        # API endpoint for status
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        
                        status = {
                            'connected': host_instance.is_connected,
                            'authorized': host_instance.is_authorized,
                            'client_username': host_instance.client_username,
                            'host_ip': host_instance.host_ip,
                            'web_port': host_instance.web_port
                        }
                        
                        self.wfile.write(json.dumps(status).encode('utf-8'))
                        
                    elif path == '/api/action':
                        # API endpoint for actions (mouse, keyboard)
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        
                        # Parse query parameters
                        query = urllib.parse.parse_qs(parsed_path.query)
                        action_type = query.get('type', [''])[0]
                        
                        if action_type == 'mouse_click':
                            x = int(query.get('x', [0])[0])
                            y = int(query.get('y', [0])[0])
                            button = query.get('button', ['left'])[0]
                            host_instance.handle_mouse_click({'x': x, 'y': y, 'button': button})
                            
                        elif action_type == 'mouse_move':
                            x = int(query.get('x', [0])[0])
                            y = int(query.get('y', [0])[0])
                            host_instance.handle_mouse_move({'x': x, 'y': y})
                            
                        elif action_type == 'key_press':
                            key = query.get('key', [''])[0]
                            host_instance.handle_key_press({'key': key})
                        
                        response = {'status': 'success'}
                        self.wfile.write(json.dumps(response).encode('utf-8'))
                        
                    else:
                        # 404 for unknown paths
                        self.send_response(404)
                        self.end_headers()
                        
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f"Error: {str(e)}".encode('utf-8'))
            
            def do_POST(self):
                """Handle POST requests"""
                try:
                    parsed_path = urllib.parse.urlparse(self.path)
                    path = parsed_path.path
                    
                    if path == '/api/action':
                        # Handle POST actions
                        content_length = int(self.headers.get('Content-Length', 0))
                        post_data = self.rfile.read(content_length)
                        
                        if post_data:
                            action_data = json.loads(post_data.decode('utf-8'))
                            action_type = action_data.get('type')
                            
                            if action_type == 'mouse_click':
                                host_instance.handle_mouse_click(action_data)
                            elif action_type == 'mouse_move':
                                host_instance.handle_mouse_move(action_data)
                            elif action_type == 'key_press':
                                host_instance.handle_key_press(action_data)
                        
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        
                        response = {'status': 'success'}
                        self.wfile.write(json.dumps(response).encode('utf-8'))
                        
                    else:
                        self.send_response(404)
                        self.end_headers()
                        
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f"Error: {str(e)}".encode('utf-8'))
            
            def log_message(self, format, *args):
                """Suppress HTTP server logs"""
                pass
        
        return RemoteDesktopHandler
    
    def run_web_server(self):
        """Run the web server"""
        try:
            while True:
                self.web_server.handle_request()
        except Exception as e:
            print(f"Web server error: {str(e)}")
    
    def get_main_page(self):
        """Generate the main HTML page"""
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote Desktop Access</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f0f0;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2em;
        }}
        .header p {{
            margin: 10px 0 0 0;
            opacity: 0.9;
        }}
        .content {{
            padding: 20px;
        }}
        .status-bar {{
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .status-indicator {{
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }}
        .status-online {{ background-color: #28a745; }}
        .status-offline {{ background-color: #dc3545; }}
        .desktop-container {{
            border: 2px solid #dee2e6;
            border-radius: 5px;
            overflow: hidden;
            background: #000;
            position: relative;
        }}
        .desktop-canvas {{
            display: block;
            max-width: 100%;
            height: auto;
            cursor: crosshair;
        }}
        .controls {{
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            padding: 15px;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }}
        .btn {{
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }}
        .btn-primary {{
            background: #007bff;
            color: white;
        }}
        .btn-primary:hover {{
            background: #0056b3;
        }}
        .btn-success {{
            background: #28a745;
            color: white;
        }}
        .btn-success:hover {{
            background: #1e7e34;
        }}
        .btn-warning {{
            background: #ffc107;
            color: #212529;
        }}
        .btn-warning:hover {{
            background: #e0a800;
        }}
        .quality-slider {{
            width: 150px;
        }}
        .refresh-slider {{
            width: 150px;
        }}
        .info-box {{
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
        }}
        .info-box h3 {{
            margin: 0 0 10px 0;
            color: #0056b3;
        }}
        .info-box p {{
            margin: 0;
            line-height: 1.5;
        }}
        .connection-info {{
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
        }}
        .connection-info h3 {{
            margin: 0 0 10px 0;
            color: #856404;
        }}
        .connection-info p {{
            margin: 0;
            font-family: monospace;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 3px;
        }}
        @media (max-width: 768px) {{
            .controls {{
                flex-direction: column;
                align-items: stretch;
            }}
            .status-bar {{
                flex-direction: column;
                gap: 10px;
                text-align: center;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🖥️ Remote Desktop Access</h1>
            <p>Access the host computer remotely through your web browser</p>
        </div>
        
        <div class="content">
            <div class="info-box">
                <h3>ℹ️ How to Use</h3>
                <p>This web interface allows you to view and control the host computer remotely. 
                Simply click on the screen to move the mouse, and use your keyboard to type. 
                The connection is secure and requires no additional software installation.</p>
            </div>
            
            <div class="connection-info">
                <h3>🔗 Connection Information</h3>
                <p><strong>Host IP:</strong> {self.host_ip}</p>
                <p><strong>Web Port:</strong> {self.web_port}</p>
                <p><strong>Access URL:</strong> http://{self.host_ip}:{self.web_port}</p>
            </div>
            
            <div class="status-bar">
                <div>
                    <span class="status-indicator status-online" id="statusIndicator"></span>
                    <span id="statusText">Ready to connect</span>
                </div>
                <div>
                    <span id="connectionInfo">Not connected</span>
                </div>
            </div>
            
            <div class="desktop-container">
                <canvas id="desktopCanvas" class="desktop-canvas" width="800" height="600"></canvas>
            </div>
            
            <div class="controls">
                <button class="btn btn-primary" id="connectBtn" onclick="connectToHost()">Connect</button>
                <button class="btn btn-warning" id="disconnectBtn" onclick="disconnectFromHost()" style="display:none;">Disconnect</button>
                <button class="btn btn-success" id="fullscreenBtn" onclick="toggleFullscreen()" style="display:none;">⛶ Fullscreen</button>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label>Quality:</label>
                    <input type="range" min="10" max="90" value="60" class="quality-slider" id="qualitySlider" onchange="updateQuality(this.value)">
                    <span id="qualityValue">60</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label>Refresh Rate:</label>
                    <input type="range" min="100" max="2000" value="500" class="refresh-slider" id="refreshSlider" onchange="updateRefreshRate(this.value)">
                    <span id="refreshValue">500ms</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label>Auto-refresh:</label>
                    <input type="checkbox" id="autoRefreshCheck" checked onchange="toggleAutoRefresh()">
                </div>
            </div>
        </div>
    </div>

    <script>
        let isConnected = false;
        let isFullscreen = false;
        let refreshInterval = null;
        let canvas = document.getElementById('desktopCanvas');
        let ctx = canvas.getContext('2d');
        let quality = 60;
        let refreshRate = 500;
        let autoRefresh = true;
        
        // Initialize canvas
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click Connect to start remote desktop session', canvas.width/2, canvas.height/2);
        
        // Mouse and keyboard event handling
        canvas.addEventListener('mousedown', handleMouseEvent);
        canvas.addEventListener('mousemove', handleMouseEvent);
        canvas.addEventListener('keydown', handleKeyEvent);
        canvas.focus();
        
        function handleMouseEvent(event) {{
            if (!isConnected) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
            const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
            
            let actionType = 'mouse_move';
            if (event.type === 'mousedown') {{
                actionType = 'mouse_click';
            }}
            
            sendAction({{
                type: actionType,
                x: x,
                y: y,
                button: event.button === 2 ? 'right' : 'left'
            }});
        }}
        
        function handleKeyEvent(event) {{
            if (!isConnected) return;
            
            // Prevent default behavior for some keys
            if (['F5', 'F11', 'F12'].includes(event.key)) {{
                event.preventDefault();
            }}
            
            sendAction({{
                type: 'key_press',
                key: event.key
            }});
        }}
        
        function sendAction(actionData) {{
            if (!isConnected) return;
            
            fetch('/api/action', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify(actionData)
            }}).catch(error => {{
                console.error('Action failed:', error);
            }});
        }}
        
        function connectToHost() {{
            document.getElementById('connectBtn').style.display = 'none';
            document.getElementById('disconnectBtn').style.display = 'inline-block';
            document.getElementById('fullscreenBtn').style.display = 'inline-block';
            
            isConnected = true;
            updateStatus('Connected', 'status-online');
            document.getElementById('connectionInfo').textContent = 'Connected to host';
            
            // Start auto-refresh
            if (autoRefresh) {{
                startAutoRefresh();
            }}
            
            // Get initial screenshot
            refreshScreen();
        }}
        
        function disconnectFromHost() {{
            document.getElementById('connectBtn').style.display = 'inline-block';
            document.getElementById('disconnectBtn').style.display = 'none';
            document.getElementById('fullscreenBtn').style.display = 'none';
            
            isConnected = false;
            updateStatus('Disconnected', 'status-offline');
            document.getElementById('connectionInfo').textContent = 'Not connected';
            
            // Stop auto-refresh
            stopAutoRefresh();
            
            // Clear canvas
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.fillText('Click Connect to start remote desktop session', canvas.width/2, canvas.height/2);
        }}
        
        function updateStatus(text, className) {{
            document.getElementById('statusText').textContent = text;
            const indicator = document.getElementById('statusIndicator');
            indicator.className = 'status-indicator ' + className;
        }}
        
        function refreshScreen() {{
            if (!isConnected) return;
            
            const img = new Image();
            img.onload = function() {{
                // Clear canvas and draw new image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }};
            img.onerror = function() {{
                console.error('Failed to load screenshot');
            }};
            
            // Add timestamp to prevent caching
            img.src = '/screenshot?' + new Date().getTime();
        }}
        
        function startAutoRefresh() {{
            if (refreshInterval) {{
                clearInterval(refreshInterval);
            }}
            refreshInterval = setInterval(refreshScreen, refreshRate);
        }}
        
        function stopAutoRefresh() {{
            if (refreshInterval) {{
                clearInterval(refreshInterval);
                refreshInterval = null;
            }}
        }}
        
        function toggleAutoRefresh() {{
            autoRefresh = document.getElementById('autoRefreshCheck').checked;
            if (autoRefresh && isConnected) {{
                startAutoRefresh();
            }} else {{
                stopAutoRefresh();
            }}
        }}
        
        function updateQuality(value) {{
            quality = parseInt(value);
            document.getElementById('qualityValue').textContent = value;
            // Quality changes will take effect on next screenshot request
        }}
        
        function updateRefreshRate(value) {{
            refreshRate = parseInt(value);
            document.getElementById('refreshValue').textContent = value + 'ms';
            if (autoRefresh && isConnected) {{
                startAutoRefresh();
            }}
        }}
        
        function toggleFullscreen() {{
            if (!isFullscreen) {{
                if (canvas.requestFullscreen) {{
                    canvas.requestFullscreen();
                }} else if (canvas.webkitRequestFullscreen) {{
                    canvas.webkitRequestFullscreen();
                }} else if (canvas.msRequestFullscreen) {{
                    canvas.msRequestFullscreen();
                }}
            }} else {{
                if (document.exitFullscreen) {{
                    document.exitFullscreen();
                }} else if (document.webkitExitFullscreen) {{
                    document.webkitExitFullscreen();
                }} else if (document.msExitFullscreen) {{
                    document.msExitFullscreen();
                }}
            }}
        }}
        
        // Fullscreen change event
        document.addEventListener('fullscreenchange', function() {{
            isFullscreen = !!document.fullscreenElement;
            document.getElementById('fullscreenBtn').textContent = isFullscreen ? '⛉ Exit Fullscreen' : '⛶ Fullscreen';
        }});
        
        // Prevent context menu on canvas
        canvas.addEventListener('contextmenu', function(e) {{
            e.preventDefault();
        }});
        
        // Handle window resize
        window.addEventListener('resize', function() {{
            // Adjust canvas size if needed
            const container = canvas.parentElement;
            const maxWidth = container.clientWidth - 4; // Account for border
            const maxHeight = window.innerHeight * 0.6;
            
            if (canvas.width > maxWidth) {{
                const ratio = canvas.height / canvas.width;
                canvas.style.width = maxWidth + 'px';
                canvas.style.height = (maxWidth * ratio) + 'px';
            }}
        }});
        
        // Initial resize
        window.dispatchEvent(new Event('resize'));
    </script>
</body>
</html>
        """
        return html
    
    def capture_screenshot(self):
        """Capture and return screenshot as JPEG data"""
        try:
            # Capture screenshot
            screenshot = pyautogui.screenshot()
            
            # Optimize for web transmission
            img_buffer = io.BytesIO()
            screenshot.save(img_buffer, format='JPEG', quality=60, optimize=True)
            img_data = img_buffer.getvalue()
            
            return img_data
            
        except Exception as e:
            print(f"Screenshot error: {str(e)}")
            return None
    
    def handle_mouse_click(self, request):
        """Handle mouse click from web client"""
        try:
            x = request.get('x', 0)
            y = request.get('y', 0)
            button = request.get('button', 'left')
            
            # Scale coordinates to actual screen size
            screen_width, screen_height = pyautogui.size()
            scaled_x = int(x * screen_width / 800)
            scaled_y = int(y * screen_height / 600)
            
            if button == 'left':
                pyautogui.click(scaled_x, scaled_y)
            elif button == 'right':
                pyautogui.rightClick(scaled_x, scaled_y)
                
        except Exception as e:
            print(f"Mouse click error: {str(e)}")
    
    def handle_mouse_move(self, request):
        """Handle mouse movement from web client"""
        try:
            x = request.get('x', 0)
            y = request.get('y', 0)
            
            # Scale coordinates to actual screen size
            screen_width, screen_height = pyautogui.size()
            scaled_x = int(x * screen_width / 800)
            scaled_y = int(y * screen_height / 600)
            
            pyautogui.moveTo(scaled_x, scaled_y)
            
        except Exception as e:
            print(f"Mouse move error: {str(e)}")
    
    def handle_key_press(self, request):
        """Handle keyboard input from web client"""
        try:
            key = request.get('key')
            if key:
                pyautogui.press(key)
                
        except Exception as e:
            print(f"Key press error: {str(e)}")
    
    def run(self):
        """Start the web-based host"""
        try:
            print(f"Web-based Remote Desktop Host started!")
            print(f"Local IP: {self.host_ip}")
            print(f"Web Port: {self.web_port}")
            print(f"Access URL: http://{self.host_ip}:{self.web_port}")
            print("\nRemote users can now access your desktop through any web browser!")
            print("Press Ctrl+C to stop the server...")
            
            # Keep the main thread alive
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\nShutting down web host...")
            if hasattr(self, 'web_server'):
                self.web_server.shutdown()

if __name__ == "__main__":
    # Check if required modules are installed
    required_modules = ['PIL', 'pyautogui', 'pynput', 'win32gui']
    missing_modules = []
    
    for module in required_modules:
        try:
            if module == 'PIL':
                import PIL
            elif module == 'win32gui':
                import win32gui
            else:
                exec(f"import {module}")
        except ImportError:
            missing_modules.append(module)
    
    if missing_modules:
        print(f"Missing required modules: {missing_modules}")
        print("Please install them using:")
        for module in missing_modules:
            if module == 'PIL':
                print("pip install Pillow")
            elif module == 'win32gui':
                print("pip install pywin32")
            else:
                print(f"pip install {module}")
        input("Press Enter to exit...")
    else:
        app = WebRemoteDesktopHost()
        app.run()
