# EasyAlbumViewer

A local photo library browser. Point it at a folder whose immediate subfolders are albums; image files in each album are shown in natural filename order.

## Set up on Windows

Requires Python 3.10 or newer.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 and use **Settings** to add one or more photo library folders. Each library's immediate subfolders are albums and should contain their photos directly. Use **Edit** to select a different folder or **Delete** to remove a library. The browser displays the configured photos but does not upload or modify them.

To stop the server, press `Ctrl+C` in the terminal.