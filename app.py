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

    def saved_library_paths():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return []
            paths = data.get("libraries")
            if paths is None:
                root = data.get("root")
                paths = [root] if root else []
            if not isinstance(paths, list):
                return []
            return [path for path in paths if isinstance(path, str) and path.strip()]
        except (OSError, ValueError, KeyError, TypeError):
            return []

    def library_root(library_index=0):
        paths = saved_library_paths()
        if library_index < 0 or library_index >= len(paths):
            return None
        try:
            root = Path(paths[library_index]).expanduser().resolve(strict=True)
            return root if root.is_dir() else None
        except (OSError, ValueError):
            return None

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
        found = []
        for library_index in range(len(saved_library_paths())):
            root = library_root(library_index)
            if not root:
                continue
            try:
                folders = list(root.iterdir())
            except OSError as error:
                app.logger.warning("Unable to read library folder %s: %s", root, error)
                continue
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
                    found.append({
                        "name": folder.name,
                        "count": len(photos),
                        "cover": photos[0].name,
                        "library": library_index,
                    })
        return sorted(found, key=lambda album: natural_key(album["name"]))

    @app.get("/")
    def index():
        return render_template("index.html", albums=albums(), libraries=saved_library_paths())

    @app.errorhandler(500)
    def handle_internal_error(error):
        flash("Unable to load the photo library. Check the configured folders and try again.", "error")
        return redirect(url_for("index"))

    @app.route("/settings", methods=["GET", "POST"])
    def settings():
        if request.method == "POST":
            entered_paths = request.form.getlist("libraries")
            if "libraries" not in request.form:
                entered_paths = [request.form.get("root", "")]
            libraries = []
            seen = set()
            try:
                for entered_path in entered_paths:
                    entered_path = entered_path.strip()
                    if not entered_path:
                        continue
                    resolved = Path(entered_path).expanduser().resolve(strict=True)
                    if not resolved.is_dir():
                        raise ValueError(f"That location is not a folder: {entered_path}")
                    normalized = str(resolved)
                    if normalized.casefold() not in seen:
                        seen.add(normalized.casefold())
                        libraries.append(normalized)
                settings_path.write_text(json.dumps({"libraries": libraries}, indent=2), encoding="utf-8")
                flash("Photo libraries saved.", "success")
                return redirect(url_for("index"))
            except (OSError, ValueError) as error:
                flash(str(error) or "Choose existing folders.", "error")
                return render_template("settings.html", libraries=entered_paths)
        return render_template("settings.html", libraries=saved_library_paths())

    @app.post("/settings/browse")
    def browse_library():
        try:
            selected = choose_library_folder()
        except RuntimeError as error:
            return jsonify(error=str(error)), 500
        return jsonify(path=selected)

    @app.get("/album/<path:album_name>")
    def slideshow(album_name):
        library_index = request.args.get("library", default=0, type=int)
        available_albums = albums()
        available = next(
            (
                album for album in available_albums
                if album["name"] == album_name and album["library"] == library_index
            ),
            None,
        )
        if not available:
            abort(404)
        photos = image_files(library_root(library_index) / album_name)
        photo_urls = [
            url_for("photo", album_name=album_name, filename=photo.name, library=library_index)
            for photo in photos
        ]
        return render_template(
            "slideshow.html",
            album=available,
            albums=available_albums,
            photo_urls=photo_urls,
        )

    @app.get("/media/<path:album_name>/<path:filename>")
    def photo(album_name, filename):
        library_index = request.args.get("library", default=0, type=int)
        root = library_root(library_index)
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