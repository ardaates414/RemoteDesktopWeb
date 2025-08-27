"""
Online Remote Desktop Web Application
Similar to Chrome Remote Desktop - accessible from anywhere online
"""

from flask import Flask, render_template, request, jsonify, send_file, session
import os
import json
import base64
import time
import uuid
from datetime import datetime, timedelta
import threading
import queue
import subprocess
import sys
import io
from PIL import Image  # Add this import for Image.Resampling

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'

# Store active sessions and connections
active_sessions = {}
active_connections = {}
file_transfers = {}
auto_capture_enabled = True  # Enable automatic screen capture

def capture_desktop_screenshot(session_id):
    """Capture the actual desktop screen at high speed"""
    try:
        import pyautogui
        
        # Capture the actual screen
        screenshot = pyautogui.screenshot()
        
        # Resize to reasonable dimensions for web transmission (smaller = faster)
        width, height = 800, 600  # Reduced size for faster processing
        screenshot = screenshot.resize((width, height), Image.Resampling.LANCZOS)
        
        # Convert to base64 with lower quality for speed
        buffer = io.BytesIO()
        screenshot.save(buffer, format='JPEG', quality=70)  # Lower quality = faster
        img_data = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            'timestamp': datetime.now().isoformat(),
            'image_data': img_data,
            'width': width,
            'height': height
        }
        
    except Exception as e:
        print(f"❌ Failed to capture desktop: {e}")
        return None

def update_desktop_screenshots():
    """Background thread to continuously capture desktop screenshots at ultra-real-time speeds"""
    while True:
        try:
            for session_id, session_obj in list(active_sessions.items()):
                if session_obj.is_active:
                    # Capture new desktop screenshot
                    new_screenshot = capture_desktop_screenshot(session_id)
                    if new_screenshot:
                        session_obj.latest_screenshot = new_screenshot
                        session_obj.screenshots.append(new_screenshot)
                        
                        # Keep only recent screenshots for performance
                        if len(session_obj.screenshots) > 2:
                            session_obj.screenshots.pop(0)
                        
                        session_obj.last_activity = datetime.now()
            
            time.sleep(0.0001)  # 10,000 FPS update rate (1/10000 = 0.0001 seconds) - Ultra-real-time!
            
        except Exception as e:
            print(f"❌ Error in desktop capture thread: {e}")
            time.sleep(0.01)  # Fallback to 100 FPS on error

class RemoteSession:
    def __init__(self, session_id, host_name, host_ip):
        self.session_id = session_id
        self.host_name = host_name
        self.host_ip = host_ip
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.clients = []
        self.screenshots = []
        self.is_active = True
        self.latest_screenshot = None

class FileTransfer:
    def __init__(self, transfer_id, filename, file_data, direction):
        self.transfer_id = transfer_id
        self.filename = filename
        self.file_data = base64.b64decode(file_data)
        self.direction = direction  # 'upload' or 'download'
        self.created_at = datetime.now()
        self.status = 'pending'

@app.route('/')
def index():
    """Main landing page"""
    return render_template('index.html')

@app.route('/host')
def host_page():
    """Host control page"""
    session_id = str(uuid.uuid4())
    session['session_id'] = session_id
    return render_template('host.html', session_id=session_id)

@app.route('/client')
def client_page():
    """Client access page"""
    return render_template('client.html')

@app.route('/api/create_session', methods=['POST'])
def create_session():
    """Create a new remote desktop session"""
    data = request.get_json()
    session_id = str(uuid.uuid4())
    
    new_session = RemoteSession(
        session_id=session_id,
        host_name=data.get('host_name', 'Unknown Host'),
        host_ip=request.remote_addr
    )
    
    active_sessions[session_id] = new_session
    session['session_id'] = session_id
    
    # Generate initial desktop screenshot immediately
    if auto_capture_enabled:
        desktop_screenshot = capture_desktop_screenshot(session_id)
        if desktop_screenshot:
            new_session.latest_screenshot = desktop_screenshot
            new_session.screenshots.append(desktop_screenshot)
            print(f"✅ Captured initial desktop screenshot for session {session_id}")
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'access_url': f"/join/{session_id}"
    })

@app.route('/api/join_session/<session_id>')
def join_session(session_id):
    """Join an existing session"""
    if session_id in active_sessions:
        session_obj = active_sessions[session_id]
        session_obj.last_activity = datetime.now()
        return render_template('remote_desktop.html', 
                             session_id=session_id,
                             host_name=session_obj.host_name)
    else:
        return "Session not found or expired", 404

@app.route('/join/<session_id>')
def join_session_direct(session_id):
    """Direct join route for clients"""
    if session_id in active_sessions:
        session_obj = active_sessions[session_id]
        session_obj.last_activity = datetime.now()
        return render_template('remote_desktop.html', 
                             session_id=session_id,
                             host_name=session_obj.host_name)
    else:
        return "Session not found or expired", 404

@app.route('/api/sessions')
def list_sessions():
    """List all active sessions"""
    sessions = []
    for session_id, session_obj in active_sessions.items():
        if session_obj.is_active and (datetime.now() - session_obj.last_activity) < timedelta(hours=24):
            sessions.append({
                'session_id': session_id,
                'host_name': session_obj.host_name,
                'created_at': session_obj.created_at.isoformat(),
                'last_activity': session_obj.last_activity.isoformat(),
                'client_count': len(session_obj.clients)
            })
        else:
            # Clean up expired sessions
            session_obj.is_active = False
    
    return jsonify(sessions)

@app.route('/api/upload_screenshot', methods=['POST'])
def upload_screenshot():
    """Upload screenshot from host"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if session_id in active_sessions:
        session_obj = active_sessions[session_id]
        
        # Store the latest screenshot
        session_obj.latest_screenshot = {
            'timestamp': datetime.now().isoformat(),
            'image_data': data.get('image_data'),
            'width': data.get('width', 800),
            'height': data.get('height', 600)
        }
        
        # Keep history of screenshots (last 2 for faster performance)
        session_obj.screenshots.append(session_obj.latest_screenshot)
        if len(session_obj.screenshots) > 2:
            session_obj.screenshots.pop(0)
        
        session_obj.last_activity = datetime.now()
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Session not found'})

@app.route('/api/get_screenshot/<session_id>')
def get_screenshot(session_id):
    """Get latest screenshot for a session"""
    if session_id in active_sessions:
        session_obj = active_sessions[session_id]
        if session_obj.latest_screenshot:
            return jsonify(session_obj.latest_screenshot)
        else:
            return jsonify({'error': 'No screenshot available yet'})
    
    return jsonify({'error': 'Session not found'})

@app.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Upload file from client to host"""
    data = request.get_json()
    session_id = data.get('session_id')
    filename = data.get('filename')
    file_data = data.get('file_data')
    
    if session_id in active_sessions:
        transfer_id = str(uuid.uuid4())
        file_transfers[transfer_id] = FileTransfer(
            transfer_id, filename, file_data, 'upload'
        )
        
        # Notify host about file upload
        if session_id in active_connections:
            active_connections[session_id].put({
                'type': 'file_upload',
                'transfer_id': transfer_id,
                'filename': filename
            })
        
        return jsonify({'success': True, 'transfer_id': transfer_id})
    
    return jsonify({'success': False, 'error': 'Session not found'})

@app.route('/api/download_file/<session_id>')
def download_file(session_id):
    """Download file from host"""
    filename = request.args.get('filename')
    
    if session_id in active_sessions:
        # This would typically get the file from the host
        # For now, return a placeholder
        return jsonify({'success': False, 'error': 'File download not implemented yet'})
    
    return jsonify({'success': False, 'error': 'Session not found'})

@app.route('/api/send_input', methods=['POST'])
def send_input():
    """Send mouse/keyboard input to the host computer"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        input_type = data.get('type')  # 'mouse' or 'keyboard'
        
        if session_id not in active_sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session_obj = active_sessions[session_id]
        session_obj.last_activity = datetime.now()
        
        # Process input based on type
        if input_type == 'mouse':
            # Handle mouse input
            action = data.get('action')  # 'move', 'click', 'scroll'
            x = data.get('x', 0)
            y = data.get('y', 0)
            button = data.get('button', 'left')  # left, right, middle
            
            try:
                import pyautogui
                
                if action == 'move':
                    pyautogui.moveTo(x, y)
                elif action == 'click':
                    pyautogui.click(x, y, button=button)
                elif action == 'scroll':
                    pyautogui.scroll(data.get('scroll_amount', 0))
                elif action == 'drag':
                    pyautogui.drag(x, y, duration=0.1)
                
                print(f"✅ Mouse input processed: {action} at ({x}, {y})")
                
            except Exception as e:
                print(f"❌ Mouse input failed: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
                
        elif input_type == 'keyboard':
            # Handle keyboard input
            action = data.get('action')  # 'press', 'release', 'type'
            key = data.get('key', '')
            
            try:
                import pyautogui
                
                if action == 'press':
                    pyautogui.keyDown(key)
                elif action == 'release':
                    pyautogui.keyUp(key)
                elif action == 'type':
                    pyautogui.typewrite(key)
                
                print(f"✅ Keyboard input processed: {action} key '{key}'")
                
            except Exception as e:
                print(f"❌ Keyboard input failed: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Input processing failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websocket/<session_id>')
def websocket_endpoint(session_id):
    """WebSocket endpoint for real-time communication"""
    # This would implement WebSocket for real-time updates
    # For now, return a placeholder
    return jsonify({'error': 'WebSocket not implemented yet'})

if __name__ == '__main__':
    # Start background desktop capture thread
    desktop_thread = threading.Thread(target=update_desktop_screenshots, daemon=True)
    desktop_thread.start()
    print("🚀 Desktop capture thread started - your screen will be captured automatically")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
