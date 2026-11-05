import json
import re
from pathlib import Path

from flask import Flask, abort, flash, jsonify, redirect, render_template, request, send_file, url_for


IMAGE_EXTENSIONS = {".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}


def choose_library_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError as error:
        raise RuntimeError("The native folder picker is unavailable in this Python installation.") from error

    try:
        window = tk.Tk()
        window.withdraw()
        window.attributes("-topmost", True)
        try:
            return filedialog.askdirectory(parent=window, title="Select photo library folder", mustexist=True) or ""
        finally:
            window.destroy()
    except tk.TclError as error:
        raise RuntimeError("Unable to open the native folder picker.") from error


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config["SECRET_KEY"] = "local-photo-library"
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    settings_path = Path(app.instance_path) / "library.json"

    @app.context_processor
    def inject_asset_url():
        def asset_url(filename):
            asset_path = Path(app.static_folder) / filename
            try:
                version = asset_path.stat().st_mtime_ns
            except OSError:
                version = 0
            return url_for("static", filename=filename, v=version)

        return {"asset_url": asset_url}

    def library_root():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            root = Path(data["root"]).expanduser().resolve(strict=True)
            return root if root.is_dir() else None
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def clear_library_setting():
        try:
            settings_path.unlink(missing_ok=True)
        except OSError:
            app.logger.exception("Unable to clear the saved library folder")

    def natural_key(value):
        return [(1, int(part)) if part.isdigit() else (0, part.casefold()) for part in re.split(r"(\d+)", value)]

    def image_files(folder):
        if not folder or not folder.is_dir():
            return []
        return sorted(
            (item for item in folder.iterdir() if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS),
            key=lambda item: natural_key(item.name),
        )

    def albums():
        root = library_root()
        if not root:
            return []
        found = []
        try:
            folders = list(root.iterdir())
        except OSError as error:
            app.logger.warning("Unable to read library folder %s: %s", root, error)
            clear_library_setting()
            return []
        for folder in folders:
            if not folder.is_dir():
                continue
            try:
                folder.resolve().relative_to(root)
            except (OSError, ValueError):
                continue
            try:
                photos = image_files(folder)
            except OSError as error:
                app.logger.warning("Skipping unreadable album folder %s: %s", folder, error)
                continue
            if photos:
                found.append({"name": folder.name, "count": len(photos), "cover": photos[0].name})
        return sorted(found, key=lambda album: natural_key(album["name"]))

    @app.get("/")
    def index():
        return render_template("index.html", albums=albums(), root=library_root())

    @app.errorhandler(500)
    def handle_internal_error(error):
        clear_library_setting()
        flash("The saved photo folder was cleared after an error. Choose an accessible folder to continue.", "error")
        return redirect(url_for("index"))

    @app.route("/settings", methods=["GET", "POST"])
    def settings():
        if request.method == "POST":
            entered_root = request.form.get("root", "").strip()
            try:
                if not entered_root:
                    raise ValueError("Choose an existing folder.")
                resolved = Path(entered_root).expanduser().resolve(strict=True)
                if not resolved.is_dir():
                    raise ValueError("That location is not a folder.")
                settings_path.write_text(json.dumps({"root": str(resolved)}, indent=2), encoding="utf-8")
                flash("Photo library folder saved.", "success")
                return redirect(url_for("index"))
            except (OSError, ValueError) as error:
                flash(str(error) or "Choose an existing folder.", "error")
        return render_template("settings.html", root=library_root())

    @app.post("/settings/browse")
    def browse_library():
        try:
            selected = choose_library_folder()
        except RuntimeError as error:
            return jsonify(error=str(error)), 500
        return jsonify(path=selected)

    @app.get("/album/<path:album_name>")
    def slideshow(album_name):
        available = next((album for album in albums() if album["name"] == album_name), None)
        if not available:
            abort(404)
        photos = image_files(library_root() / album_name)
        photo_urls = [url_for("photo", album_name=album_name, filename=photo.name) for photo in photos]
        return render_template("slideshow.html", album=available, photo_urls=photo_urls)

    @app.get("/media/<path:album_name>/<path:filename>")
    def photo(album_name, filename):
        root = library_root()
        if not root:
            abort(404)
        folder = (root / album_name).resolve()
        try:
            folder.relative_to(root)
        except ValueError:
            abort(404)
        if not folder.is_dir():
            abort(404)
        image = (folder / filename).resolve()
        try:
            image.relative_to(folder)
        except ValueError:
            abort(404)
        if not image.is_file() or image.suffix.lower() not in IMAGE_EXTENSIONS:
            abort(404)
        return send_file(image)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)