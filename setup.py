"""
Setup script for Remote Desktop Application
Installs required dependencies and provides usage instructions
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages"""
    print("Installing required packages...")
    
    try:
        # Install packages from requirements.txt
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ All dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return False

def check_existing_packages():
    """Check which packages are already installed"""
    print("Checking existing packages...")
    
    packages = ['Pillow', 'pyautogui', 'pynput', 'pywin32']
    missing_packages = []
    
    for package in packages:
        try:
            if package == 'Pillow':
                import PIL
                print(f"✅ {package} is already installed")
            elif package == 'pywin32':
                import win32gui
                print(f"✅ {package} is already installed")
            else:
                __import__(package.lower())
                print(f"✅ {package} is already installed")
        except ImportError:
            print(f"❌ {package} is missing")
            missing_packages.append(package)
    
    return missing_packages

def main():
    print("=== Remote Desktop Application Setup ===\n")
    
    # Check current directory
    if not os.path.exists("host_app.py") or not os.path.exists("client_app.py"):
        print("❌ Error: Make sure you're running this script from the RemoteDesktopApp directory")
        input("Press Enter to exit...")
        return
    
    # Check existing packages
    missing = check_existing_packages()
    
    if missing:
        print(f"\nMissing packages: {', '.join(missing)}")
        install_choice = input("\nDo you want to install missing packages? (y/n): ").lower()
        
        if install_choice in ['y', 'yes']:
            if install_requirements():
                print("\n🎉 Setup completed successfully!")
            else:
                print("\n❌ Setup failed. Please install packages manually using:")
                print("pip install -r requirements.txt")
                input("Press Enter to exit...")
                return
        else:
            print("\nYou can install packages later using: pip install -r requirements.txt")
    else:
        print("\n✅ All required packages are already installed!")
    
    print("\n" + "="*50)
    print("USAGE INSTRUCTIONS:")
    print("="*50)
    print("\n🖥️  HOST (Computer being controlled):")
    print("   1. Run: python host_app.py")
    print("   2. Click 'Start Host'")
    print("   3. Share your IP address with the person connecting")
    print("   4. When someone tries to connect, approve or deny the request")
    
    print("\n💻 CLIENT (Computer doing the controlling):")
    print("   1. Run: python client_app.py")
    print("   2. Enter the host's IP address")
    print("   3. Enter your username")
    print("   4. Click 'Connect'")
    print("   5. Wait for host to approve your connection")
    
    print("\n🔒 SECURITY FEATURES:")
    print("   • Host must approve each connection request")
    print("   • Shows username of person trying to connect")
    print("   • File transfers are scanned for viruses")
    print("   • Host can ask permission before receiving infected files")
    
    print("\n📁 FILE TRANSFER:")
    print("   • Use the 'File Transfer' tab in client app")
    print("   • Send files, images, videos to host")
    print("   • Request files from host")
    print("   • Automatic virus scanning on host side")
    
    print("\n⚠️  IMPORTANT NOTES:")
    print("   • Both computers must be on the same network")
    print("   • Or use port forwarding for internet connections")
    print("   • Default port is 9999 (configurable)")
    print("   • Windows Defender will be used for virus scanning")
    
    print("\n" + "="*50)
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
