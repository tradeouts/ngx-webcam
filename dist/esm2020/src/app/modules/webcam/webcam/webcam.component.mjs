import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { WebcamImage } from '../domain/webcam-image';
import { WebcamUtil } from '../util/webcam.util';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
export class WebcamComponent {
    constructor() {
        /** Defines the max width of the webcam area in px */
        this.width = 640;
        /** Defines the max height of the webcam area in px */
        this.height = 480;
        /** Defines base constraints to apply when requesting video track from UserMedia */
        this.videoOptions = WebcamComponent.DEFAULT_VIDEO_OPTIONS;
        /** Flag to enable/disable camera switch. If enabled, a switch icon will be displayed if multiple cameras were found */
        this.allowCameraSwitch = true;
        /** Flag to control whether an ImageData object is stored into the WebcamImage object. */
        this.captureImageData = false;
        /** The image type to use when capturing snapshots */
        this.imageType = WebcamComponent.DEFAULT_IMAGE_TYPE;
        /** The image quality to use when capturing snapshots (number between 0 and 1) */
        this.imageQuality = WebcamComponent.DEFAULT_IMAGE_QUALITY;
        /** EventEmitter which fires when an image has been captured */
        this.imageCapture = new EventEmitter();
        /** Emits a mediaError if webcam cannot be initialized (e.g. missing user permissions) */
        this.initError = new EventEmitter();
        /** Emits when the webcam video was clicked */
        this.imageClick = new EventEmitter();
        /** Emits the active deviceId after the active video device was switched */
        this.cameraSwitched = new EventEmitter();
        /** available video devices */
        this.availableVideoInputs = [];
        /** Indicates whether the video device is ready to be switched */
        this.videoInitialized = false;
        /** Index of active video in availableVideoInputs */
        this.activeVideoInputIndex = -1;
        /** MediaStream object in use for streaming UserMedia data */
        this.mediaStream = null;
        /** width and height of the active video stream */
        this.activeVideoSettings = null;
    }
    /**
     * If the given Observable emits, an image will be captured and emitted through 'imageCapture' EventEmitter
     */
    set trigger(trigger) {
        if (this.triggerSubscription) {
            this.triggerSubscription.unsubscribe();
        }
        // Subscribe to events from this Observable to take snapshots
        this.triggerSubscription = trigger.subscribe(() => {
            this.takeSnapshot();
        });
    }
    /**
     * If the given Observable emits, the active webcam will be switched to the one indicated by the emitted value.
     * @param switchCamera Indicates which webcam to switch to
     *   true: cycle forwards through available webcams
     *   false: cycle backwards through available webcams
     *   string: activate the webcam with the given id
     */
    set switchCamera(switchCamera) {
        if (this.switchCameraSubscription) {
            this.switchCameraSubscription.unsubscribe();
        }
        // Subscribe to events from this Observable to switch video device
        this.switchCameraSubscription = switchCamera.subscribe((value) => {
            if (typeof value === 'string') {
                // deviceId was specified
                this.switchToVideoInput(value);
            }
            else {
                // direction was specified
                this.rotateVideoInput(value !== false);
            }
        });
    }
    /**
     * Get MediaTrackConstraints to request streaming the given device
     * @param deviceId
     * @param baseMediaTrackConstraints base constraints to merge deviceId-constraint into
     * @returns
     */
    static getMediaConstraintsForDevice(deviceId, baseMediaTrackConstraints) {
        const result = baseMediaTrackConstraints ? baseMediaTrackConstraints : this.DEFAULT_VIDEO_OPTIONS;
        if (deviceId) {
            result.deviceId = { exact: deviceId };
        }
        return result;
    }
    /**
     * Tries to harvest the deviceId from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the id.
     * @param mediaStreamTrack
     * @returns deviceId if found in the mediaStreamTrack
     */
    static getDeviceIdFromMediaStreamTrack(mediaStreamTrack) {
        if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().deviceId) {
            return mediaStreamTrack.getSettings().deviceId;
        }
        else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().deviceId) {
            const deviceIdObj = mediaStreamTrack.getConstraints().deviceId;
            return WebcamComponent.getValueFromConstrainDOMString(deviceIdObj);
        }
    }
    /**
     * Tries to harvest the facingMode from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the value.
     * @param mediaStreamTrack
     * @returns facingMode if found in the mediaStreamTrack
     */
    static getFacingModeFromMediaStreamTrack(mediaStreamTrack) {
        if (mediaStreamTrack) {
            if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().facingMode) {
                return mediaStreamTrack.getSettings().facingMode;
            }
            else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().facingMode) {
                const facingModeConstraint = mediaStreamTrack.getConstraints().facingMode;
                return WebcamComponent.getValueFromConstrainDOMString(facingModeConstraint);
            }
        }
    }
    /**
     * Determines whether the given mediaStreamTrack claims itself as user facing
     * @param mediaStreamTrack
     */
    static isUserFacing(mediaStreamTrack) {
        const facingMode = WebcamComponent.getFacingModeFromMediaStreamTrack(mediaStreamTrack);
        return facingMode ? 'user' === facingMode.toLowerCase() : false;
    }
    /**
     * Extracts the value from the given ConstrainDOMString
     * @param constrainDOMString
     */
    static getValueFromConstrainDOMString(constrainDOMString) {
        if (constrainDOMString) {
            if (constrainDOMString instanceof String) {
                return String(constrainDOMString);
            }
            else if (Array.isArray(constrainDOMString) && Array(constrainDOMString).length > 0) {
                return String(constrainDOMString[0]);
            }
            else if (typeof constrainDOMString === 'object') {
                if (constrainDOMString['exact']) {
                    return String(constrainDOMString['exact']);
                }
                else if (constrainDOMString['ideal']) {
                    return String(constrainDOMString['ideal']);
                }
            }
        }
        return null;
    }
    ngAfterViewInit() {
        this.detectAvailableDevices()
            .then(() => {
            // start video
            this.switchToVideoInput(null);
        })
            .catch((err) => {
            this.initError.next({ message: err });
            // fallback: still try to load webcam, even if device enumeration failed
            this.switchToVideoInput(null);
        });
    }
    ngOnDestroy() {
        this.stopMediaTracks();
        this.unsubscribeFromSubscriptions();
    }
    /**
     * Takes a snapshot of the current webcam's view and emits the image as an event
     */
    takeSnapshot() {
        // set canvas size to actual video size
        const _video = this.nativeVideoElement;
        const dimensions = { width: this.width, height: this.height };
        if (_video.videoWidth) {
            dimensions.width = _video.videoWidth;
            dimensions.height = _video.videoHeight;
        }
        const _canvas = this.canvas.nativeElement;
        _canvas.width = dimensions.width;
        _canvas.height = dimensions.height;
        // paint snapshot image to canvas
        const context2d = _canvas.getContext('2d');
        context2d.drawImage(_video, 0, 0);
        // read canvas content as image
        const mimeType = this.imageType ? this.imageType : WebcamComponent.DEFAULT_IMAGE_TYPE;
        const quality = this.imageQuality ? this.imageQuality : WebcamComponent.DEFAULT_IMAGE_QUALITY;
        const dataUrl = _canvas.toDataURL(mimeType, quality);
        // get the ImageData object from the canvas' context.
        let imageData = null;
        if (this.captureImageData) {
            imageData = context2d.getImageData(0, 0, _canvas.width, _canvas.height);
        }
        this.imageCapture.next(new WebcamImage(dataUrl, mimeType, imageData));
    }
    /**
     * Switches to the next/previous video device
     * @param forward
     */
    rotateVideoInput(forward) {
        if (this.availableVideoInputs && this.availableVideoInputs.length > 1) {
            const increment = forward ? 1 : (this.availableVideoInputs.length - 1);
            const nextInputIndex = (this.activeVideoInputIndex + increment) % this.availableVideoInputs.length;
            this.switchToVideoInput(this.availableVideoInputs[nextInputIndex].deviceId);
        }
    }
    /**
     * Switches the camera-view to the specified video device
     */
    switchToVideoInput(deviceId) {
        this.videoInitialized = false;
        this.stopMediaTracks();
        this.initWebcam(deviceId, this.videoOptions);
    }
    /**
     * Event-handler for video resize event.
     * Triggers Angular change detection so that new video dimensions get applied
     */
    videoResize() {
        // here to trigger Angular change detection
    }
    get videoWidth() {
        const videoRatio = this.getVideoAspectRatio();
        return Math.min(this.width, this.height * videoRatio);
    }
    get videoHeight() {
        const videoRatio = this.getVideoAspectRatio();
        return Math.min(this.height, this.width / videoRatio);
    }
    get videoStyleClasses() {
        let classes = '';
        if (this.isMirrorImage()) {
            classes += 'mirrored ';
        }
        return classes.trim();
    }
    get nativeVideoElement() {
        return this.video.nativeElement;
    }
    /**
     * Returns the video aspect ratio of the active video stream
     */
    getVideoAspectRatio() {
        // calculate ratio from video element dimensions if present
        const videoElement = this.nativeVideoElement;
        if (videoElement.videoWidth && videoElement.videoWidth > 0 &&
            videoElement.videoHeight && videoElement.videoHeight > 0) {
            return videoElement.videoWidth / videoElement.videoHeight;
        }
        // nothing present - calculate ratio based on width/height params
        return this.width / this.height;
    }
    /**
     * Init webcam live view
     */
    initWebcam(deviceId, userVideoTrackConstraints) {
        const _video = this.nativeVideoElement;
        _video.setAttribute('autoplay', '');
        _video.setAttribute('muted', '');
        _video.setAttribute('playsinline', '');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // merge deviceId -> userVideoTrackConstraints
            const videoTrackConstraints = WebcamComponent.getMediaConstraintsForDevice(deviceId, userVideoTrackConstraints);
            navigator.mediaDevices.getUserMedia({ video: videoTrackConstraints })
                .then((stream) => {
                this.mediaStream = stream;
                _video.srcObject = stream;
                _video.play();
                this.activeVideoSettings = stream.getVideoTracks()[0].getSettings();
                const activeDeviceId = WebcamComponent.getDeviceIdFromMediaStreamTrack(stream.getVideoTracks()[0]);
                this.cameraSwitched.next(activeDeviceId);
                // Initial detect may run before user gave permissions, returning no deviceIds. This prevents later camera switches. (#47)
                // Run detect once again within getUserMedia callback, to make sure this time we have permissions and get deviceIds.
                this.detectAvailableDevices()
                    .then(() => {
                    this.activeVideoInputIndex = activeDeviceId ? this.availableVideoInputs
                        .findIndex((mediaDeviceInfo) => mediaDeviceInfo.deviceId === activeDeviceId) : -1;
                    this.videoInitialized = true;
                })
                    .catch(() => {
                    this.activeVideoInputIndex = -1;
                    this.videoInitialized = true;
                });
            })
                .catch((err) => {
                this.initError.next({ message: err.message, mediaStreamError: err });
            });
        }
        else {
            this.initError.next({ message: 'Cannot read UserMedia from MediaDevices.' });
        }
    }
    getActiveVideoTrack() {
        return this.mediaStream ? this.mediaStream.getVideoTracks()[0] : null;
    }
    isMirrorImage() {
        if (!this.getActiveVideoTrack()) {
            return false;
        }
        // check for explicit mirror override parameter
        {
            let mirror = 'auto';
            if (this.mirrorImage) {
                if (typeof this.mirrorImage === 'string') {
                    mirror = String(this.mirrorImage).toLowerCase();
                }
                else {
                    // WebcamMirrorProperties
                    if (this.mirrorImage.x) {
                        mirror = this.mirrorImage.x.toLowerCase();
                    }
                }
            }
            switch (mirror) {
                case 'always':
                    return true;
                case 'never':
                    return false;
            }
        }
        // default: enable mirroring if webcam is user facing
        return WebcamComponent.isUserFacing(this.getActiveVideoTrack());
    }
    /**
     * Stops all active media tracks.
     * This prevents the webcam from being indicated as active,
     * even if it is no longer used by this component.
     */
    stopMediaTracks() {
        if (this.mediaStream && this.mediaStream.getTracks) {
            // pause video to prevent mobile browser freezes
            this.nativeVideoElement.pause();
            // getTracks() returns all media tracks (video+audio)
            this.mediaStream.getTracks()
                .forEach((track) => track.stop());
        }
    }
    /**
     * Unsubscribe from all open subscriptions
     */
    unsubscribeFromSubscriptions() {
        if (this.triggerSubscription) {
            this.triggerSubscription.unsubscribe();
        }
        if (this.switchCameraSubscription) {
            this.switchCameraSubscription.unsubscribe();
        }
    }
    /**
     * Reads available input devices
     */
    detectAvailableDevices() {
        return new Promise((resolve, reject) => {
            WebcamUtil.getAvailableVideoInputs()
                .then((devices) => {
                this.availableVideoInputs = devices;
                resolve(devices);
            })
                .catch(err => {
                this.availableVideoInputs = [];
                reject(err);
            });
        });
    }
}
WebcamComponent.DEFAULT_VIDEO_OPTIONS = { facingMode: 'environment' };
WebcamComponent.DEFAULT_IMAGE_TYPE = 'image/jpeg';
WebcamComponent.DEFAULT_IMAGE_QUALITY = 0.92;
WebcamComponent.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "13.0.0", ngImport: i0, type: WebcamComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
WebcamComponent.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "12.0.0", version: "13.0.0", type: WebcamComponent, selector: "webcam", inputs: { width: "width", height: "height", videoOptions: "videoOptions", allowCameraSwitch: "allowCameraSwitch", mirrorImage: "mirrorImage", captureImageData: "captureImageData", imageType: "imageType", imageQuality: "imageQuality", trigger: "trigger", switchCamera: "switchCamera" }, outputs: { imageCapture: "imageCapture", initError: "initError", imageClick: "imageClick", cameraSwitched: "cameraSwitched" }, viewQueries: [{ propertyName: "video", first: true, predicate: ["video"], descendants: true, static: true }, { propertyName: "canvas", first: true, predicate: ["canvas"], descendants: true, static: true }], ngImport: i0, template: "<div class=\"webcam-wrapper\" (click)=\"imageClick.next();\">\r\n  <video #video [width]=\"videoWidth\" [height]=\"videoHeight\" [class]=\"videoStyleClasses\" autoplay muted playsinline (resize)=\"videoResize()\"></video>\r\n  <div class=\"camera-switch\" *ngIf=\"allowCameraSwitch && availableVideoInputs.length > 1 && videoInitialized\" (click)=\"rotateVideoInput(true)\"></div>\r\n  <canvas #canvas [width]=\"width\" [height]=\"height\"></canvas>\r\n</div>\r\n", styles: [".webcam-wrapper{display:inline-block;position:relative;line-height:0}.webcam-wrapper video.mirrored{transform:scaleX(-1)}.webcam-wrapper canvas{display:none}.webcam-wrapper .camera-switch{background-color:#0000001a;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE9UlEQVR42u2aT2hdRRTGf+cRQqghSqihdBFDkRISK2KDfzDWxHaRQHEhaINKqa1gKQhd6EZLN+IidCH+Q0oWIkVRC21BQxXRitVaSbKoJSGtYGoK2tQ/tU1jY5v0c5F54Xl7b/KSO/PyEt+3e5f75p7zzZwzZ74zUEIJJfyfYaEGllQGVAGZlENdBy6Z2cSiYFTSKkkfS/pH/nBF0kFJdUW9AiRVASeAukD8DgNrzOySrwEzng18KaDzALXuG8W3AiStAvqBisBRNg40mtlPxbYCOgvgPO4bncWW+JpVeDQXRQhIygDfA00F5r0XuNfMrgclQFI98DDQCNQA5ZFXqoCWBVp8XwHRHeEqcN7loy/NbHBesyqpQ1KfFj/6nC+ZvFaApFrgPaCZpYVvgCfNbDiRAElNwGFg+RIt/X8H2s2s9wYCJDUAR4HqJX7++RN40MwGpgmQVAH0AQ2BPz4AHHPl8nBOAqtyFWQjsA6oL4Ada81sPDv7uwImod8kvSJp9RyS8O2SXnb/DYVd2Y9VSroQ4ANXJO2WVJmixqh0kzMWwL4LkiqRtDnA4D1zmfE8j9g9AezcnAHaPcfXdbfdnPZ2Yps6+DwAvO/Z1naTdApY7Xng48BDZnY1MpMVQBuw3iXc5Tnb0wBwBPjUzP6eoezuArZ6svM0geJLkvZEYnl3nkntoqROSbckSW2Suj3ZOIangc7GPJuUtNGdFIfmMeavktoSSKiW9LMPw30Q8JqkekmjCbOZRhuclLQjgYSNxUBAj6RyZ9ATgUJpUtJTCSR8vpAEXHAyWK5BXYFIGHOlepSAloUk4NEYgyoknQhEwhFJ0e8h6VSaQeerCb5uZgdi9utxYBNwOUD93hIVXswM4INCi6K9wAszFC2DwLOBDjHbYp59karIUnRdzYy/3ClqVklaUhfwTICj7K25OqA7a4wWagVsm4Me/xzwg2cCqqONFzO7DPxSCAJi436GUBgHHguQD2oTlJ55oSzP9ybccsttSJw1szdjFOSnI/8dTCGZHwcORp4Nx7y3B1iZ8/sm4MW8/Euxg5wIsS/HaAp3zeP4/G7obRDXI4jiTIA22H7Xdc7X+S3A5lC7QBQ357aq3VAjCeSkwUfAJrfvz+R8A9ADLAtZB+TinpjC5JMA+//jwPZZnF8G7J+L8z4IWB/zbG+gIujVWfLBW/NStVMmqaG4POJRsIjix7h8IGnLQuoBbQki5sVAJHyYm7YkNaRRtXwQ8G1cHpX0iKRrgUjYno17Sf0LrQhJUkdCeHWkVITGJI0k1QeS3ikGSUzOyJUJJNznYneuOCnpTldcxa2kP3xJYqOeSDjqZG8ShJLnE8TTuMS6Iyu1BW7djZqkfo9N0QOuYJmYQddfB7RG+gLTNzqAY9FrL+5/nwEbvDdJJe3zzOrhNP3AWRqmk55t3ZcBuj3b2gb0Sbrbo/NNzk7fFzu7s/E5EiC+rrmeQU0Kx2skvRFoOx2ZzlmSdgbsw49JetvtBpk8nM64d/cGbNtJ0s7cGyJlwHeEv+t3nqnLSgPAUOSGyG3AHUxdzqoJbEcvcL+ZTeTeEapzJKxgaeOcc/7Mf06D7kFrguS0VDAMtGadv+E47DT9tcChJej8ISfpD+abgTe45uOkFi8mnQ+JBVQ+d4VXuOptjavcyot8pq86mfwk8LWZnaOEEkoooYQSSojDv8AhQNeGfe0jAAAAAElFTkSuQmCC);background-repeat:no-repeat;border-radius:5px;position:absolute;right:13px;top:10px;height:48px;width:48px;background-size:80%;cursor:pointer;background-position:center;transition:background-color .2s ease}.webcam-wrapper .camera-switch:hover{background-color:#0000002e}\n"], directives: [{ type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "13.0.0", ngImport: i0, type: WebcamComponent, decorators: [{
            type: Component,
            args: [{ selector: 'webcam', template: "<div class=\"webcam-wrapper\" (click)=\"imageClick.next();\">\r\n  <video #video [width]=\"videoWidth\" [height]=\"videoHeight\" [class]=\"videoStyleClasses\" autoplay muted playsinline (resize)=\"videoResize()\"></video>\r\n  <div class=\"camera-switch\" *ngIf=\"allowCameraSwitch && availableVideoInputs.length > 1 && videoInitialized\" (click)=\"rotateVideoInput(true)\"></div>\r\n  <canvas #canvas [width]=\"width\" [height]=\"height\"></canvas>\r\n</div>\r\n", styles: [".webcam-wrapper{display:inline-block;position:relative;line-height:0}.webcam-wrapper video.mirrored{transform:scaleX(-1)}.webcam-wrapper canvas{display:none}.webcam-wrapper .camera-switch{background-color:#0000001a;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE9UlEQVR42u2aT2hdRRTGf+cRQqghSqihdBFDkRISK2KDfzDWxHaRQHEhaINKqa1gKQhd6EZLN+IidCH+Q0oWIkVRC21BQxXRitVaSbKoJSGtYGoK2tQ/tU1jY5v0c5F54Xl7b/KSO/PyEt+3e5f75p7zzZwzZ74zUEIJJfyfYaEGllQGVAGZlENdBy6Z2cSiYFTSKkkfS/pH/nBF0kFJdUW9AiRVASeAukD8DgNrzOySrwEzng18KaDzALXuG8W3AiStAvqBisBRNg40mtlPxbYCOgvgPO4bncWW+JpVeDQXRQhIygDfA00F5r0XuNfMrgclQFI98DDQCNQA5ZFXqoCWBVp8XwHRHeEqcN7loy/NbHBesyqpQ1KfFj/6nC+ZvFaApFrgPaCZpYVvgCfNbDiRAElNwGFg+RIt/X8H2s2s9wYCJDUAR4HqJX7++RN40MwGpgmQVAH0AQ2BPz4AHHPl8nBOAqtyFWQjsA6oL4Ada81sPDv7uwImod8kvSJp9RyS8O2SXnb/DYVd2Y9VSroQ4ANXJO2WVJmixqh0kzMWwL4LkiqRtDnA4D1zmfE8j9g9AezcnAHaPcfXdbfdnPZ2Yps6+DwAvO/Z1naTdApY7Xng48BDZnY1MpMVQBuw3iXc5Tnb0wBwBPjUzP6eoezuArZ6svM0geJLkvZEYnl3nkntoqROSbckSW2Suj3ZOIangc7GPJuUtNGdFIfmMeavktoSSKiW9LMPw30Q8JqkekmjCbOZRhuclLQjgYSNxUBAj6RyZ9ATgUJpUtJTCSR8vpAEXHAyWK5BXYFIGHOlepSAloUk4NEYgyoknQhEwhFJ0e8h6VSaQeerCb5uZgdi9utxYBNwOUD93hIVXswM4INCi6K9wAszFC2DwLOBDjHbYp59karIUnRdzYy/3ClqVklaUhfwTICj7K25OqA7a4wWagVsm4Me/xzwg2cCqqONFzO7DPxSCAJi436GUBgHHguQD2oTlJ55oSzP9ybccsttSJw1szdjFOSnI/8dTCGZHwcORp4Nx7y3B1iZ8/sm4MW8/Euxg5wIsS/HaAp3zeP4/G7obRDXI4jiTIA22H7Xdc7X+S3A5lC7QBQ357aq3VAjCeSkwUfAJrfvz+R8A9ADLAtZB+TinpjC5JMA+//jwPZZnF8G7J+L8z4IWB/zbG+gIujVWfLBW/NStVMmqaG4POJRsIjix7h8IGnLQuoBbQki5sVAJHyYm7YkNaRRtXwQ8G1cHpX0iKRrgUjYno17Sf0LrQhJUkdCeHWkVITGJI0k1QeS3ikGSUzOyJUJJNznYneuOCnpTldcxa2kP3xJYqOeSDjqZG8ShJLnE8TTuMS6Iyu1BW7djZqkfo9N0QOuYJmYQddfB7RG+gLTNzqAY9FrL+5/nwEbvDdJJe3zzOrhNP3AWRqmk55t3ZcBuj3b2gb0Sbrbo/NNzk7fFzu7s/E5EiC+rrmeQU0Kx2skvRFoOx2ZzlmSdgbsw49JetvtBpk8nM64d/cGbNtJ0s7cGyJlwHeEv+t3nqnLSgPAUOSGyG3AHUxdzqoJbEcvcL+ZTeTeEapzJKxgaeOcc/7Mf06D7kFrguS0VDAMtGadv+E47DT9tcChJej8ISfpD+abgTe45uOkFi8mnQ+JBVQ+d4VXuOptjavcyot8pq86mfwk8LWZnaOEEkoooYQSSojDv8AhQNeGfe0jAAAAAElFTkSuQmCC);background-repeat:no-repeat;border-radius:5px;position:absolute;right:13px;top:10px;height:48px;width:48px;background-size:80%;cursor:pointer;background-position:center;transition:background-color .2s ease}.webcam-wrapper .camera-switch:hover{background-color:#0000002e}\n"] }]
        }], propDecorators: { width: [{
                type: Input
            }], height: [{
                type: Input
            }], videoOptions: [{
                type: Input
            }], allowCameraSwitch: [{
                type: Input
            }], mirrorImage: [{
                type: Input
            }], captureImageData: [{
                type: Input
            }], imageType: [{
                type: Input
            }], imageQuality: [{
                type: Input
            }], imageCapture: [{
                type: Output
            }], initError: [{
                type: Output
            }], imageClick: [{
                type: Output
            }], cameraSwitched: [{
                type: Output
            }], video: [{
                type: ViewChild,
                args: ['video', { static: true }]
            }], canvas: [{
                type: ViewChild,
                args: ['canvas', { static: true }]
            }], trigger: [{
                type: Input
            }], switchCamera: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViY2FtLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcHAvbW9kdWxlcy93ZWJjYW0vd2ViY2FtL3dlYmNhbS5jb21wb25lbnQudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBwL21vZHVsZXMvd2ViY2FtL3dlYmNhbS93ZWJjYW0uY29tcG9uZW50Lmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFnQixTQUFTLEVBQWMsWUFBWSxFQUFFLEtBQUssRUFBYSxNQUFNLEVBQUUsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXRILE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVuRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0scUJBQXFCLENBQUM7OztBQVEvQyxNQUFNLE9BQU8sZUFBZTtJQUw1QjtRQVVFLHFEQUFxRDtRQUNyQyxVQUFLLEdBQVcsR0FBRyxDQUFDO1FBQ3BDLHNEQUFzRDtRQUN0QyxXQUFNLEdBQVcsR0FBRyxDQUFDO1FBQ3JDLG1GQUFtRjtRQUNuRSxpQkFBWSxHQUEwQixlQUFlLENBQUMscUJBQXFCLENBQUM7UUFDNUYsdUhBQXVIO1FBQ3ZHLHNCQUFpQixHQUFZLElBQUksQ0FBQztRQUdsRCx5RkFBeUY7UUFDekUscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ2xELHFEQUFxRDtRQUNyQyxjQUFTLEdBQVcsZUFBZSxDQUFDLGtCQUFrQixDQUFDO1FBQ3ZFLGlGQUFpRjtRQUNqRSxpQkFBWSxHQUFXLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQztRQUU3RSwrREFBK0Q7UUFDOUMsaUJBQVksR0FBOEIsSUFBSSxZQUFZLEVBQWUsQ0FBQztRQUMzRix5RkFBeUY7UUFDeEUsY0FBUyxHQUFrQyxJQUFJLFlBQVksRUFBbUIsQ0FBQztRQUNoRyw4Q0FBOEM7UUFDN0IsZUFBVSxHQUF1QixJQUFJLFlBQVksRUFBUSxD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O1lBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7O0FBcGFjLHFDQUFxQixHQUEwQixFQUFDLFVBQVUsRUFBRSxhQUFhLEVBQUUsQ0FBQTtBQUMzRSxrQ0FBa0IsR0FBVyxZQUFhLENBQUE7QUFDMUMscUNBQXFCLEdBQVcsSUFBSyxDQUFBOzRHQUh6QyxlQUFlO2dHQUFmLGVBQWUsMHBCQ1o1QixpZEFLQTsyRkRPYSxlQUFlO2tCQUwzQixTQUFTOytCQUNFLFFBQVE7OEJBVUYsS0FBSztzQkFBcEIsS0FBSztnQkFFVSxNQUFNO3NCQUFyQixLQUFLO2dCQUVVLFlBQVk7c0JBQTNCLEtBQUs7Z0JBRVUsaUJBQWlCO3NCQUFoQyxLQUFLO2dCQUVVLFdBQVc7c0JBQTFCLEtBQUs7Z0JBRVUsZ0JBQWdCO3NCQUEvQixLQUFLO2dCQUVVLFNBQVM7c0JBQXhCLEtBQUs7Z0JBRVUsWUFBWTtzQkFBM0IsS0FBSztnQkFHVyxZQUFZO3NCQUE1QixNQUFNO2dCQUVVLFNBQVM7c0JBQXpCLE1BQU07Z0JBRVUsVUFBVTtzQkFBMUIsTUFBTTtnQkFFVSxjQUFjO3NCQUE5QixNQUFNO2dCQWlCdUMsS0FBSztzQkFBbEQsU0FBUzt1QkFBQyxPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO2dCQUVXLE1BQU07c0JBQXBELFNBQVM7dUJBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtnQkFTMUIsT0FBTztzQkFEakIsS0FBSztnQkFvQkssWUFBWTtzQkFEdEIsS0FBSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QWZ0ZXJWaWV3SW5pdCwgQ29tcG9uZW50LCBFbGVtZW50UmVmLCBFdmVudEVtaXR0ZXIsIElucHV0LCBPbkRlc3Ryb3ksIE91dHB1dCwgVmlld0NoaWxkfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHtXZWJjYW1Jbml0RXJyb3J9IGZyb20gJy4uL2RvbWFpbi93ZWJjYW0taW5pdC1lcnJvcic7XHJcbmltcG9ydCB7V2ViY2FtSW1hZ2V9IGZyb20gJy4uL2RvbWFpbi93ZWJjYW0taW1hZ2UnO1xyXG5pbXBvcnQge09ic2VydmFibGUsIFN1YnNjcmlwdGlvbn0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7V2ViY2FtVXRpbH0gZnJvbSAnLi4vdXRpbC93ZWJjYW0udXRpbCc7XHJcbmltcG9ydCB7V2ViY2FtTWlycm9yUHJvcGVydGllc30gZnJvbSAnLi4vZG9tYWluL3dlYmNhbS1taXJyb3ItcHJvcGVydGllcyc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ3dlYmNhbScsXHJcbiAgdGVtcGxhdGVVcmw6ICcuL3dlYmNhbS5jb21wb25lbnQuaHRtbCcsXHJcbiAgc3R5bGVVcmxzOiBbJy4vd2ViY2FtLmNvbXBvbmVudC5zY3NzJ11cclxufSlcclxuZXhwb3J0IGNsYXNzIFdlYmNhbUNvbXBvbmVudCBpbXBsZW1lbnRzIEFmdGVyVmlld0luaXQsIE9uRGVzdHJveSB7XHJcbiAgcHJpdmF0ZSBzdGF0aWMgREVGQVVMVF9WSURFT19PUFRJT05TOiBNZWRpYVRyYWNrQ29uc3RyYWludHMgPSB7ZmFjaW5nTW9kZTogJ2Vudmlyb25tZW50J307XHJcbiAgcHJpdmF0ZSBzdGF0aWMgREVGQVVMVF9JTUFHRV9UWVBFOiBzdHJpbmcgPSAnaW1hZ2UvanBlZyc7XHJcbiAgcHJpdmF0ZSBzdGF0aWMgREVGQVVMVF9JTUFHRV9RVUFMSVRZOiBudW1iZXIgPSAwLjkyO1xyXG5cclxuICAvKiogRGVmaW5lcyB0aGUgbWF4IHdpZHRoIG9mIHRoZSB3ZWJjYW0gYXJlYSBpbiBweCAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyB3aWR0aDogbnVtYmVyID0gNjQwO1xyXG4gIC8qKiBEZWZpbmVzIHRoZSBtYXggaGVpZ2h0IG9mIHRoZSB3ZWJjYW0gYXJlYSBpbiBweCAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBoZWlnaHQ6IG51bWJlciA9IDQ4MDtcclxuICAvKiogRGVmaW5lcyBiYXNlIGNvbnN0cmFpbnRzIHRvIGFwcGx5IHdoZW4gcmVxdWVzdGluZyB2aWRlbyB0cmFjayBmcm9tIFVzZXJNZWRpYSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyB2aWRlb09wdGlvbnM6IE1lZGlhVHJhY2tDb25zdHJhaW50cyA9IFdlYmNhbUNvbXBvbmVudC5ERUZBVUxUX1ZJREVPX09QVElPTlM7XHJcbiAgLyoqIEZsYWcgdG8gZW5hYmxlL2Rpc2FibGUgY2FtZXJhIHN3aXRjaC4gSWYgZW5hYmxlZCwgYSBzd2l0Y2ggaWNvbiB3aWxsIGJlIGRpc3BsYXllZCBpZiBtdWx0aXBsZSBjYW1lcmFzIHdlcmUgZm91bmQgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgYWxsb3dDYW1lcmFTd2l0Y2g6IGJvb2xlYW4gPSB0cnVlO1xyXG4gIC8qKiBQYXJhbWV0ZXIgdG8gY29udHJvbCBpbWFnZSBtaXJyb3JpbmcgKGkuZS4gZm9yIHVzZXItZmFjaW5nIGNhbWVyYSkuIFtcImF1dG9cIiwgXCJhbHdheXNcIiwgXCJuZXZlclwiXSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBtaXJyb3JJbWFnZTogc3RyaW5nIHwgV2ViY2FtTWlycm9yUHJvcGVydGllcztcclxuICAvKiogRmxhZyB0byBjb250cm9sIHdoZXRoZXIgYW4gSW1hZ2VEYXRhIG9iamVjdCBpcyBzdG9yZWQgaW50byB0aGUgV2ViY2FtSW1hZ2Ugb2JqZWN0LiAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBjYXB0dXJlSW1hZ2VEYXRhOiBib29sZWFuID0gZmFsc2U7XHJcbiAgLyoqIFRoZSBpbWFnZSB0eXBlIHRvIHVzZSB3aGVuIGNhcHR1cmluZyBzbmFwc2hvdHMgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgaW1hZ2VUeXBlOiBzdHJpbmcgPSBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9UWVBFO1xyXG4gIC8qKiBUaGUgaW1hZ2UgcXVhbGl0eSB0byB1c2Ugd2hlbiBjYXB0dXJpbmcgc25hcHNob3RzIChudW1iZXIgYmV0d2VlbiAwIGFuZCAxKSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBpbWFnZVF1YWxpdHk6IG51bWJlciA9IFdlYmNhbUNvbXBvbmVudC5ERUZBVUxUX0lNQUdFX1FVQUxJVFk7XHJcblxyXG4gIC8qKiBFdmVudEVtaXR0ZXIgd2hpY2ggZmlyZXMgd2hlbiBhbiBpbWFnZSBoYXMgYmVlbiBjYXB0dXJlZCAqL1xyXG4gIEBPdXRwdXQoKSBwdWJsaWMgaW1hZ2VDYXB0dXJlOiBFdmVudEVtaXR0ZXI8V2ViY2FtSW1hZ2U+ID0gbmV3IEV2ZW50RW1pdHRlcjxXZWJjYW1JbWFnZT4oKTtcclxuICAvKiogRW1pdHMgYSBtZWRpYUVycm9yIGlmIHdlYmNhbSBjYW5ub3QgYmUgaW5pdGlhbGl6ZWQgKGUuZy4gbWlzc2luZyB1c2VyIHBlcm1pc3Npb25zKSAqL1xyXG4gIEBPdXRwdXQoKSBwdWJsaWMgaW5pdEVycm9yOiBFdmVudEVtaXR0ZXI8V2ViY2FtSW5pdEVycm9yPiA9IG5ldyBFdmVudEVtaXR0ZXI8V2ViY2FtSW5pdEVycm9yPigpO1xyXG4gIC8qKiBFbWl0cyB3aGVuIHRoZSB3ZWJjYW0gdmlkZW8gd2FzIGNsaWNrZWQgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGltYWdlQ2xpY2s6IEV2ZW50RW1pdHRlcjx2b2lkPiA9IG5ldyBFdmVudEVtaXR0ZXI8dm9pZD4oKTtcclxuICAvKiogRW1pdHMgdGhlIGFjdGl2ZSBkZXZpY2VJZCBhZnRlciB0aGUgYWN0aXZlIHZpZGVvIGRldmljZSB3YXMgc3dpdGNoZWQgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGNhbWVyYVN3aXRjaGVkOiBFdmVudEVtaXR0ZXI8c3RyaW5nPiA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xyXG5cclxuICAvKiogYXZhaWxhYmxlIHZpZGVvIGRldmljZXMgKi9cclxuICBwdWJsaWMgYXZhaWxhYmxlVmlkZW9JbnB1dHM6IE1lZGlhRGV2aWNlSW5mb1tdID0gW107XHJcblxyXG4gIC8qKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgdmlkZW8gZGV2aWNlIGlzIHJlYWR5IHRvIGJlIHN3aXRjaGVkICovXHJcbiAgcHVibGljIHZpZGVvSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgLyoqIElmIHRoZSBPYnNlcnZhYmxlIHJlcHJlc2VudGVkIGJ5IHRoaXMgc3Vic2NyaXB0aW9uIGVtaXRzLCBhbiBpbWFnZSB3aWxsIGJlIGNhcHR1cmVkIGFuZCBlbWl0dGVkIHRocm91Z2hcclxuICAgKiB0aGUgJ2ltYWdlQ2FwdHVyZScgRXZlbnRFbWl0dGVyICovXHJcbiAgcHJpdmF0ZSB0cmlnZ2VyU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XHJcbiAgLyoqIEluZGV4IG9mIGFjdGl2ZSB2aWRlbyBpbiBhdmFpbGFibGVWaWRlb0lucHV0cyAqL1xyXG4gIHByaXZhdGUgYWN0aXZlVmlkZW9JbnB1dEluZGV4OiBudW1iZXIgPSAtMTtcclxuICAvKiogU3Vic2NyaXB0aW9uIHRvIHN3aXRjaENhbWVyYSBldmVudHMgKi9cclxuICBwcml2YXRlIHN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xyXG4gIC8qKiBNZWRpYVN0cmVhbSBvYmplY3QgaW4gdXNlIGZvciBzdHJlYW1pbmcgVXNlck1lZGlhIGRhdGEgKi9cclxuICBwcml2YXRlIG1lZGlhU3RyZWFtOiBNZWRpYVN0cmVhbSA9IG51bGw7XHJcbiAgQFZpZXdDaGlsZCgndmlkZW8nLCB7IHN0YXRpYzogdHJ1ZSB9KSBwcml2YXRlIHZpZGVvOiBFbGVtZW50UmVmPEhUTUxWaWRlb0VsZW1lbnQ+O1xyXG4gIC8qKiBDYW52YXMgZm9yIFZpZGVvIFNuYXBzaG90cyAqL1xyXG4gIEBWaWV3Q2hpbGQoJ2NhbnZhcycsIHsgc3RhdGljOiB0cnVlIH0pIHByaXZhdGUgY2FudmFzOiBFbGVtZW50UmVmPEhUTUxDYW52YXNFbGVtZW50PjtcclxuXHJcbiAgLyoqIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhlIGFjdGl2ZSB2aWRlbyBzdHJlYW0gKi9cclxuICBwcml2YXRlIGFjdGl2ZVZpZGVvU2V0dGluZ3M6IE1lZGlhVHJhY2tTZXR0aW5ncyA9IG51bGw7XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIHRoZSBnaXZlbiBPYnNlcnZhYmxlIGVtaXRzLCBhbiBpbWFnZSB3aWxsIGJlIGNhcHR1cmVkIGFuZCBlbWl0dGVkIHRocm91Z2ggJ2ltYWdlQ2FwdHVyZScgRXZlbnRFbWl0dGVyXHJcbiAgICovXHJcbiAgQElucHV0KClcclxuICBwdWJsaWMgc2V0IHRyaWdnZXIodHJpZ2dlcjogT2JzZXJ2YWJsZTx2b2lkPikge1xyXG4gICAgaWYgKHRoaXMudHJpZ2dlclN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTdWJzY3JpYmUgdG8gZXZlbnRzIGZyb20gdGhpcyBPYnNlcnZhYmxlIHRvIHRha2Ugc25hcHNob3RzXHJcbiAgICB0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24gPSB0cmlnZ2VyLnN1YnNjcmliZSgoKSA9PiB7XHJcbiAgICAgIHRoaXMudGFrZVNuYXBzaG90KCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIHRoZSBnaXZlbiBPYnNlcnZhYmxlIGVtaXRzLCB0aGUgYWN0aXZlIHdlYmNhbSB3aWxsIGJlIHN3aXRjaGVkIHRvIHRoZSBvbmUgaW5kaWNhdGVkIGJ5IHRoZSBlbWl0dGVkIHZhbHVlLlxyXG4gICAqIEBwYXJhbSBzd2l0Y2hDYW1lcmEgSW5kaWNhdGVzIHdoaWNoIHdlYmNhbSB0byBzd2l0Y2ggdG9cclxuICAgKiAgIHRydWU6IGN5Y2xlIGZvcndhcmRzIHRocm91Z2ggYXZhaWxhYmxlIHdlYmNhbXNcclxuICAgKiAgIGZhbHNlOiBjeWNsZSBiYWNrd2FyZHMgdGhyb3VnaCBhdmFpbGFibGUgd2ViY2Ftc1xyXG4gICAqICAgc3RyaW5nOiBhY3RpdmF0ZSB0aGUgd2ViY2FtIHdpdGggdGhlIGdpdmVuIGlkXHJcbiAgICovXHJcbiAgQElucHV0KClcclxuICBwdWJsaWMgc2V0IHN3aXRjaENhbWVyYShzd2l0Y2hDYW1lcmE6IE9ic2VydmFibGU8Ym9vbGVhbiB8IHN0cmluZz4pIHtcclxuICAgIGlmICh0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFN1YnNjcmliZSB0byBldmVudHMgZnJvbSB0aGlzIE9ic2VydmFibGUgdG8gc3dpdGNoIHZpZGVvIGRldmljZVxyXG4gICAgdGhpcy5zd2l0Y2hDYW1lcmFTdWJzY3JpcHRpb24gPSBzd2l0Y2hDYW1lcmEuc3Vic2NyaWJlKCh2YWx1ZTogYm9vbGVhbiB8IHN0cmluZykgPT4ge1xyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIC8vIGRldmljZUlkIHdhcyBzcGVjaWZpZWRcclxuICAgICAgICB0aGlzLnN3aXRjaFRvVmlkZW9JbnB1dCh2YWx1ZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gZGlyZWN0aW9uIHdhcyBzcGVjaWZpZWRcclxuICAgICAgICB0aGlzLnJvdGF0ZVZpZGVvSW5wdXQodmFsdWUgIT09IGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgTWVkaWFUcmFja0NvbnN0cmFpbnRzIHRvIHJlcXVlc3Qgc3RyZWFtaW5nIHRoZSBnaXZlbiBkZXZpY2VcclxuICAgKiBAcGFyYW0gZGV2aWNlSWRcclxuICAgKiBAcGFyYW0gYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50cyBiYXNlIGNvbnN0cmFpbnRzIHRvIG1lcmdlIGRldmljZUlkLWNvbnN0cmFpbnQgaW50b1xyXG4gICAqIEByZXR1cm5zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0TWVkaWFDb25zdHJhaW50c0ZvckRldmljZShkZXZpY2VJZDogc3RyaW5nLCBiYXNlTWVkaWFUcmFja0NvbnN0cmFpbnRzOiBNZWRpYVRyYWNrQ29uc3RyYWludHMpOiBNZWRpYVRyYWNrQ29uc3RyYWludHMge1xyXG4gICAgY29uc3QgcmVzdWx0OiBNZWRpYVRyYWNrQ29uc3RyYWludHMgPSBiYXNlTWVkaWFUcmFja0NvbnN0cmFpbnRzID8gYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50cyA6IHRoaXMuREVGQVVMVF9WSURFT19PUFRJT05TO1xyXG4gICAgaWYgKGRldmljZUlkKSB7XHJcbiAgICAgIHJlc3VsdC5kZXZpY2VJZCA9IHtleGFjdDogZGV2aWNlSWR9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUcmllcyB0byBoYXJ2ZXN0IHRoZSBkZXZpY2VJZCBmcm9tIHRoZSBnaXZlbiBtZWRpYVN0cmVhbVRyYWNrIG9iamVjdC5cclxuICAgKiBCcm93c2VycyBwb3B1bGF0ZSB0aGlzIG9iamVjdCBkaWZmZXJlbnRseTsgdGhpcyBtZXRob2QgdHJpZXMgc29tZSBkaWZmZXJlbnQgYXBwcm9hY2hlc1xyXG4gICAqIHRvIHJlYWQgdGhlIGlkLlxyXG4gICAqIEBwYXJhbSBtZWRpYVN0cmVhbVRyYWNrXHJcbiAgICogQHJldHVybnMgZGV2aWNlSWQgaWYgZm91bmQgaW4gdGhlIG1lZGlhU3RyZWFtVHJhY2tcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBnZXREZXZpY2VJZEZyb21NZWRpYVN0cmVhbVRyYWNrKG1lZGlhU3RyZWFtVHJhY2s6IE1lZGlhU3RyZWFtVHJhY2spOiBzdHJpbmcge1xyXG4gICAgaWYgKG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKS5kZXZpY2VJZCkge1xyXG4gICAgICByZXR1cm4gbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpLmRldmljZUlkO1xyXG4gICAgfSBlbHNlIGlmIChtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKSAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkuZGV2aWNlSWQpIHtcclxuICAgICAgY29uc3QgZGV2aWNlSWRPYmo6IENvbnN0cmFpbkRPTVN0cmluZyA9IG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKS5kZXZpY2VJZDtcclxuICAgICAgcmV0dXJuIFdlYmNhbUNvbXBvbmVudC5nZXRWYWx1ZUZyb21Db25zdHJhaW5ET01TdHJpbmcoZGV2aWNlSWRPYmopO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVHJpZXMgdG8gaGFydmVzdCB0aGUgZmFjaW5nTW9kZSBmcm9tIHRoZSBnaXZlbiBtZWRpYVN0cmVhbVRyYWNrIG9iamVjdC5cclxuICAgKiBCcm93c2VycyBwb3B1bGF0ZSB0aGlzIG9iamVjdCBkaWZmZXJlbnRseTsgdGhpcyBtZXRob2QgdHJpZXMgc29tZSBkaWZmZXJlbnQgYXBwcm9hY2hlc1xyXG4gICAqIHRvIHJlYWQgdGhlIHZhbHVlLlxyXG4gICAqIEBwYXJhbSBtZWRpYVN0cmVhbVRyYWNrXHJcbiAgICogQHJldHVybnMgZmFjaW5nTW9kZSBpZiBmb3VuZCBpbiB0aGUgbWVkaWFTdHJlYW1UcmFja1xyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIGdldEZhY2luZ01vZGVGcm9tTWVkaWFTdHJlYW1UcmFjayhtZWRpYVN0cmVhbVRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrKTogc3RyaW5nIHtcclxuICAgIGlmIChtZWRpYVN0cmVhbVRyYWNrKSB7XHJcbiAgICAgIGlmIChtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKSAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzKCkuZmFjaW5nTW9kZSkge1xyXG4gICAgICAgIHJldHVybiBtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzKCkuZmFjaW5nTW9kZTtcclxuICAgICAgfSBlbHNlIGlmIChtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKSAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkuZmFjaW5nTW9kZSkge1xyXG4gICAgICAgIGNvbnN0IGZhY2luZ01vZGVDb25zdHJhaW50OiBDb25zdHJhaW5ET01TdHJpbmcgPSBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkuZmFjaW5nTW9kZTtcclxuICAgICAgICByZXR1cm4gV2ViY2FtQ29tcG9uZW50LmdldFZhbHVlRnJvbUNvbnN0cmFpbkRPTVN0cmluZyhmYWNpbmdNb2RlQ29uc3RyYWludCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERldGVybWluZXMgd2hldGhlciB0aGUgZ2l2ZW4gbWVkaWFTdHJlYW1UcmFjayBjbGFpbXMgaXRzZWxmIGFzIHVzZXIgZmFjaW5nXHJcbiAgICogQHBhcmFtIG1lZGlhU3RyZWFtVHJhY2tcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBpc1VzZXJGYWNpbmcobWVkaWFTdHJlYW1UcmFjazogTWVkaWFTdHJlYW1UcmFjayk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgZmFjaW5nTW9kZTogc3RyaW5nID0gV2ViY2FtQ29tcG9uZW50LmdldEZhY2luZ01vZGVGcm9tTWVkaWFTdHJlYW1UcmFjayhtZWRpYVN0cmVhbVRyYWNrKTtcclxuICAgIHJldHVybiBmYWNpbmdNb2RlID8gJ3VzZXInID09PSBmYWNpbmdNb2RlLnRvTG93ZXJDYXNlKCkgOiBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV4dHJhY3RzIHRoZSB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBDb25zdHJhaW5ET01TdHJpbmdcclxuICAgKiBAcGFyYW0gY29uc3RyYWluRE9NU3RyaW5nXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0VmFsdWVGcm9tQ29uc3RyYWluRE9NU3RyaW5nKGNvbnN0cmFpbkRPTVN0cmluZzogQ29uc3RyYWluRE9NU3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmIChjb25zdHJhaW5ET01TdHJpbmcpIHtcclxuICAgICAgaWYgKGNvbnN0cmFpbkRPTVN0cmluZyBpbnN0YW5jZW9mIFN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBTdHJpbmcoY29uc3RyYWluRE9NU3RyaW5nKTtcclxuICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbnN0cmFpbkRPTVN0cmluZykgJiYgQXJyYXkoY29uc3RyYWluRE9NU3RyaW5nKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIFN0cmluZyhjb25zdHJhaW5ET01TdHJpbmdbMF0pO1xyXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zdHJhaW5ET01TdHJpbmcgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgaWYgKGNvbnN0cmFpbkRPTVN0cmluZ1snZXhhY3QnXSkge1xyXG4gICAgICAgICAgcmV0dXJuIFN0cmluZyhjb25zdHJhaW5ET01TdHJpbmdbJ2V4YWN0J10pO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWluRE9NU3RyaW5nWydpZGVhbCddKSB7XHJcbiAgICAgICAgICByZXR1cm4gU3RyaW5nKGNvbnN0cmFpbkRPTVN0cmluZ1snaWRlYWwnXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbmdBZnRlclZpZXdJbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5kZXRlY3RBdmFpbGFibGVEZXZpY2VzKClcclxuICAgICAgLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIC8vIHN0YXJ0IHZpZGVvXHJcbiAgICAgICAgdGhpcy5zd2l0Y2hUb1ZpZGVvSW5wdXQobnVsbCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaCgoZXJyOiBzdHJpbmcpID0+IHtcclxuICAgICAgICB0aGlzLmluaXRFcnJvci5uZXh0KDxXZWJjYW1Jbml0RXJyb3I+e21lc3NhZ2U6IGVycn0pO1xyXG4gICAgICAgIC8vIGZhbGxiYWNrOiBzdGlsbCB0cnkgdG8gbG9hZCB3ZWJjYW0sIGV2ZW4gaWYgZGV2aWNlIGVudW1lcmF0aW9uIGZhaWxlZFxyXG4gICAgICAgIHRoaXMuc3dpdGNoVG9WaWRlb0lucHV0KG51bGwpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcE1lZGlhVHJhY2tzKCk7XHJcbiAgICB0aGlzLnVuc3Vic2NyaWJlRnJvbVN1YnNjcmlwdGlvbnMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRha2VzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgd2ViY2FtJ3MgdmlldyBhbmQgZW1pdHMgdGhlIGltYWdlIGFzIGFuIGV2ZW50XHJcbiAgICovXHJcbiAgcHVibGljIHRha2VTbmFwc2hvdCgpOiB2b2lkIHtcclxuICAgIC8vIHNldCBjYW52YXMgc2l6ZSB0byBhY3R1YWwgdmlkZW8gc2l6ZVxyXG4gICAgY29uc3QgX3ZpZGVvID0gdGhpcy5uYXRpdmVWaWRlb0VsZW1lbnQ7XHJcbiAgICBjb25zdCBkaW1lbnNpb25zID0ge3dpZHRoOiB0aGlzLndpZHRoLCBoZWlnaHQ6IHRoaXMuaGVpZ2h0fTtcclxuICAgIGlmIChfdmlkZW8udmlkZW9XaWR0aCkge1xyXG4gICAgICBkaW1lbnNpb25zLndpZHRoID0gX3ZpZGVvLnZpZGVvV2lkdGg7XHJcbiAgICAgIGRpbWVuc2lvbnMuaGVpZ2h0ID0gX3ZpZGVvLnZpZGVvSGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IF9jYW52YXMgPSB0aGlzLmNhbnZhcy5uYXRpdmVFbGVtZW50O1xyXG4gICAgX2NhbnZhcy53aWR0aCA9IGRpbWVuc2lvbnMud2lkdGg7XHJcbiAgICBfY2FudmFzLmhlaWdodCA9IGRpbWVuc2lvbnMuaGVpZ2h0O1xyXG5cclxuICAgIC8vIHBhaW50IHNuYXBzaG90IGltYWdlIHRvIGNhbnZhc1xyXG4gICAgY29uc3QgY29udGV4dDJkID0gX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgY29udGV4dDJkLmRyYXdJbWFnZShfdmlkZW8sIDAsIDApO1xyXG5cclxuICAgIC8vIHJlYWQgY2FudmFzIGNvbnRlbnQgYXMgaW1hZ2VcclxuICAgIGNvbnN0IG1pbWVUeXBlOiBzdHJpbmcgPSB0aGlzLmltYWdlVHlwZSA/IHRoaXMuaW1hZ2VUeXBlIDogV2ViY2FtQ29tcG9uZW50LkRFRkFVTFRfSU1BR0VfVFlQRTtcclxuICAgIGNvbnN0IHF1YWxpdHk6IG51bWJlciA9IHRoaXMuaW1hZ2VRdWFsaXR5ID8gdGhpcy5pbWFnZVF1YWxpdHkgOiBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9RVUFMSVRZO1xyXG4gICAgY29uc3QgZGF0YVVybDogc3RyaW5nID0gX2NhbnZhcy50b0RhdGFVUkwobWltZVR5cGUsIHF1YWxpdHkpO1xyXG5cclxuICAgIC8vIGdldCB0aGUgSW1hZ2VEYXRhIG9iamVjdCBmcm9tIHRoZSBjYW52YXMnIGNvbnRleHQuXHJcbiAgICBsZXQgaW1hZ2VEYXRhOiBJbWFnZURhdGEgPSBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLmNhcHR1cmVJbWFnZURhdGEpIHtcclxuICAgICAgaW1hZ2VEYXRhID0gY29udGV4dDJkLmdldEltYWdlRGF0YSgwLCAwLCBfY2FudmFzLndpZHRoLCBfY2FudmFzLmhlaWdodCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5pbWFnZUNhcHR1cmUubmV4dChuZXcgV2ViY2FtSW1hZ2UoZGF0YVVybCwgbWltZVR5cGUsIGltYWdlRGF0YSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3dpdGNoZXMgdG8gdGhlIG5leHQvcHJldmlvdXMgdmlkZW8gZGV2aWNlXHJcbiAgICogQHBhcmFtIGZvcndhcmRcclxuICAgKi9cclxuICBwdWJsaWMgcm90YXRlVmlkZW9JbnB1dChmb3J3YXJkOiBib29sZWFuKSB7XHJcbiAgICBpZiAodGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cyAmJiB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgY29uc3QgaW5jcmVtZW50OiBudW1iZXIgPSBmb3J3YXJkID8gMSA6ICh0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aCAtIDEpO1xyXG4gICAgICBjb25zdCBuZXh0SW5wdXRJbmRleCA9ICh0aGlzLmFjdGl2ZVZpZGVvSW5wdXRJbmRleCArIGluY3JlbWVudCkgJSB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aDtcclxuICAgICAgdGhpcy5zd2l0Y2hUb1ZpZGVvSW5wdXQodGhpcy5hdmFpbGFibGVWaWRlb0lucHV0c1tuZXh0SW5wdXRJbmRleF0uZGV2aWNlSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3dpdGNoZXMgdGhlIGNhbWVyYS12aWV3IHRvIHRoZSBzcGVjaWZpZWQgdmlkZW8gZGV2aWNlXHJcbiAgICovXHJcbiAgcHVibGljIHN3aXRjaFRvVmlkZW9JbnB1dChkZXZpY2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnZpZGVvSW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuc3RvcE1lZGlhVHJhY2tzKCk7XHJcbiAgICB0aGlzLmluaXRXZWJjYW0oZGV2aWNlSWQsIHRoaXMudmlkZW9PcHRpb25zKTtcclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBFdmVudC1oYW5kbGVyIGZvciB2aWRlbyByZXNpemUgZXZlbnQuXHJcbiAgICogVHJpZ2dlcnMgQW5ndWxhciBjaGFuZ2UgZGV0ZWN0aW9uIHNvIHRoYXQgbmV3IHZpZGVvIGRpbWVuc2lvbnMgZ2V0IGFwcGxpZWRcclxuICAgKi9cclxuICBwdWJsaWMgdmlkZW9SZXNpemUoKTogdm9pZCB7XHJcbiAgICAvLyBoZXJlIHRvIHRyaWdnZXIgQW5ndWxhciBjaGFuZ2UgZGV0ZWN0aW9uXHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHZpZGVvV2lkdGgoKSB7XHJcbiAgICBjb25zdCB2aWRlb1JhdGlvID0gdGhpcy5nZXRWaWRlb0FzcGVjdFJhdGlvKCk7XHJcbiAgICByZXR1cm4gTWF0aC5taW4odGhpcy53aWR0aCwgdGhpcy5oZWlnaHQgKiB2aWRlb1JhdGlvKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdmlkZW9IZWlnaHQoKSB7XHJcbiAgICBjb25zdCB2aWRlb1JhdGlvID0gdGhpcy5nZXRWaWRlb0FzcGVjdFJhdGlvKCk7XHJcbiAgICByZXR1cm4gTWF0aC5taW4odGhpcy5oZWlnaHQsIHRoaXMud2lkdGggLyB2aWRlb1JhdGlvKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdmlkZW9TdHlsZUNsYXNzZXMoKSB7XHJcbiAgICBsZXQgY2xhc3Nlczogc3RyaW5nID0gJyc7XHJcblxyXG4gICAgaWYgKHRoaXMuaXNNaXJyb3JJbWFnZSgpKSB7XHJcbiAgICAgIGNsYXNzZXMgKz0gJ21pcnJvcmVkICc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNsYXNzZXMudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBuYXRpdmVWaWRlb0VsZW1lbnQoKSB7XHJcbiAgICByZXR1cm4gdGhpcy52aWRlby5uYXRpdmVFbGVtZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgdmlkZW8gYXNwZWN0IHJhdGlvIG9mIHRoZSBhY3RpdmUgdmlkZW8gc3RyZWFtXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRWaWRlb0FzcGVjdFJhdGlvKCk6IG51bWJlciB7XHJcbiAgICAvLyBjYWxjdWxhdGUgcmF0aW8gZnJvbSB2aWRlbyBlbGVtZW50IGRpbWVuc2lvbnMgaWYgcHJlc2VudFxyXG4gICAgY29uc3QgdmlkZW9FbGVtZW50ID0gdGhpcy5uYXRpdmVWaWRlb0VsZW1lbnQ7XHJcbiAgICBpZiAodmlkZW9FbGVtZW50LnZpZGVvV2lkdGggJiYgdmlkZW9FbGVtZW50LnZpZGVvV2lkdGggPiAwICYmXHJcbiAgICAgIHZpZGVvRWxlbWVudC52aWRlb0hlaWdodCAmJiB2aWRlb0VsZW1lbnQudmlkZW9IZWlnaHQgPiAwKSB7XHJcblxyXG4gICAgICByZXR1cm4gdmlkZW9FbGVtZW50LnZpZGVvV2lkdGggLyB2aWRlb0VsZW1lbnQudmlkZW9IZWlnaHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbm90aGluZyBwcmVzZW50IC0gY2FsY3VsYXRlIHJhdGlvIGJhc2VkIG9uIHdpZHRoL2hlaWdodCBwYXJhbXNcclxuICAgIHJldHVybiB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0IHdlYmNhbSBsaXZlIHZpZXdcclxuICAgKi9cclxuICBwcml2YXRlIGluaXRXZWJjYW0oZGV2aWNlSWQ6IHN0cmluZywgdXNlclZpZGVvVHJhY2tDb25zdHJhaW50czogTWVkaWFUcmFja0NvbnN0cmFpbnRzKSB7XHJcbiAgICBjb25zdCBfdmlkZW8gPSB0aGlzLm5hdGl2ZVZpZGVvRWxlbWVudDtcclxuICAgIFxyXG4gICAgX3ZpZGVvLnNldEF0dHJpYnV0ZSgnYXV0b3BsYXknLCAnJyk7XHJcbiAgICBfdmlkZW8uc2V0QXR0cmlidXRlKCdtdXRlZCcsICcnKTtcclxuICAgIF92aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xyXG4gICAgXHJcbiAgICBpZiAobmF2aWdhdG9yLm1lZGlhRGV2aWNlcyAmJiBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSkge1xyXG5cclxuICAgICAgLy8gbWVyZ2UgZGV2aWNlSWQgLT4gdXNlclZpZGVvVHJhY2tDb25zdHJhaW50c1xyXG4gICAgICBjb25zdCB2aWRlb1RyYWNrQ29uc3RyYWludHMgPSBXZWJjYW1Db21wb25lbnQuZ2V0TWVkaWFDb25zdHJhaW50c0ZvckRldmljZShkZXZpY2VJZCwgdXNlclZpZGVvVHJhY2tDb25zdHJhaW50cyk7XHJcblxyXG4gICAgICBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSg8TWVkaWFTdHJlYW1Db25zdHJhaW50cz57dmlkZW86IHZpZGVvVHJhY2tDb25zdHJhaW50c30pXHJcbiAgICAgICAgLnRoZW4oKHN0cmVhbTogTWVkaWFTdHJlYW0pID0+IHtcclxuICAgICAgICAgIHRoaXMubWVkaWFTdHJlYW0gPSBzdHJlYW07XHJcbiAgICAgICAgICBfdmlkZW8uc3JjT2JqZWN0ID0gc3RyZWFtO1xyXG4gICAgICAgICAgX3ZpZGVvLnBsYXkoKTtcclxuXHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZVZpZGVvU2V0dGluZ3MgPSBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKVswXS5nZXRTZXR0aW5ncygpO1xyXG4gICAgICAgICAgY29uc3QgYWN0aXZlRGV2aWNlSWQ6IHN0cmluZyA9IFdlYmNhbUNvbXBvbmVudC5nZXREZXZpY2VJZEZyb21NZWRpYVN0cmVhbVRyYWNrKHN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdKTtcclxuXHJcbiAgICAgICAgICB0aGlzLmNhbWVyYVN3aXRjaGVkLm5leHQoYWN0aXZlRGV2aWNlSWQpO1xyXG5cclxuICAgICAgICAgIC8vIEluaXRpYWwgZGV0ZWN0IG1heSBydW4gYmVmb3JlIHVzZXIgZ2F2ZSBwZXJtaXNzaW9ucywgcmV0dXJuaW5nIG5vIGRldmljZUlkcy4gVGhpcyBwcmV2ZW50cyBsYXRlciBjYW1lcmEgc3dpdGNoZXMuICgjNDcpXHJcbiAgICAgICAgICAvLyBSdW4gZGV0ZWN0IG9uY2UgYWdhaW4gd2l0aGluIGdldFVzZXJNZWRpYSBjYWxsYmFjaywgdG8gbWFrZSBzdXJlIHRoaXMgdGltZSB3ZSBoYXZlIHBlcm1pc3Npb25zIGFuZCBnZXQgZGV2aWNlSWRzLlxyXG4gICAgICAgICAgdGhpcy5kZXRlY3RBdmFpbGFibGVEZXZpY2VzKClcclxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMuYWN0aXZlVmlkZW9JbnB1dEluZGV4ID0gYWN0aXZlRGV2aWNlSWQgPyB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzXHJcbiAgICAgICAgICAgICAgICAuZmluZEluZGV4KChtZWRpYURldmljZUluZm86IE1lZGlhRGV2aWNlSW5mbykgPT4gbWVkaWFEZXZpY2VJbmZvLmRldmljZUlkID09PSBhY3RpdmVEZXZpY2VJZCkgOiAtMTtcclxuICAgICAgICAgICAgICB0aGlzLnZpZGVvSW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAuY2F0Y2goKCkgPT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMuYWN0aXZlVmlkZW9JbnB1dEluZGV4ID0gLTE7XHJcbiAgICAgICAgICAgICAgdGhpcy52aWRlb0luaXRpYWxpemVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKGVycjogRE9NRXhjZXB0aW9uKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmluaXRFcnJvci5uZXh0KDxXZWJjYW1Jbml0RXJyb3I+e21lc3NhZ2U6IGVyci5tZXNzYWdlLCBtZWRpYVN0cmVhbUVycm9yOiBlcnJ9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuaW5pdEVycm9yLm5leHQoPFdlYmNhbUluaXRFcnJvcj57bWVzc2FnZTogJ0Nhbm5vdCByZWFkIFVzZXJNZWRpYSBmcm9tIE1lZGlhRGV2aWNlcy4nfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEFjdGl2ZVZpZGVvVHJhY2soKTogTWVkaWFTdHJlYW1UcmFjayB7XHJcbiAgICByZXR1cm4gdGhpcy5tZWRpYVN0cmVhbSA/IHRoaXMubWVkaWFTdHJlYW0uZ2V0VmlkZW9UcmFja3MoKVswXSA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzTWlycm9ySW1hZ2UoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoIXRoaXMuZ2V0QWN0aXZlVmlkZW9UcmFjaygpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBjaGVjayBmb3IgZXhwbGljaXQgbWlycm9yIG92ZXJyaWRlIHBhcmFtZXRlclxyXG4gICAge1xyXG4gICAgICBsZXQgbWlycm9yOiBzdHJpbmcgPSAnYXV0byc7XHJcbiAgICAgIGlmICh0aGlzLm1pcnJvckltYWdlKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1pcnJvckltYWdlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgbWlycm9yID0gU3RyaW5nKHRoaXMubWlycm9ySW1hZ2UpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIFdlYmNhbU1pcnJvclByb3BlcnRpZXNcclxuICAgICAgICAgIGlmICh0aGlzLm1pcnJvckltYWdlLngpIHtcclxuICAgICAgICAgICAgbWlycm9yID0gdGhpcy5taXJyb3JJbWFnZS54LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBzd2l0Y2ggKG1pcnJvcikge1xyXG4gICAgICAgIGNhc2UgJ2Fsd2F5cyc6XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBjYXNlICduZXZlcic6XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBkZWZhdWx0OiBlbmFibGUgbWlycm9yaW5nIGlmIHdlYmNhbSBpcyB1c2VyIGZhY2luZ1xyXG4gICAgcmV0dXJuIFdlYmNhbUNvbXBvbmVudC5pc1VzZXJGYWNpbmcodGhpcy5nZXRBY3RpdmVWaWRlb1RyYWNrKCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcHMgYWxsIGFjdGl2ZSBtZWRpYSB0cmFja3MuXHJcbiAgICogVGhpcyBwcmV2ZW50cyB0aGUgd2ViY2FtIGZyb20gYmVpbmcgaW5kaWNhdGVkIGFzIGFjdGl2ZSxcclxuICAgKiBldmVuIGlmIGl0IGlzIG5vIGxvbmdlciB1c2VkIGJ5IHRoaXMgY29tcG9uZW50LlxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RvcE1lZGlhVHJhY2tzKCkge1xyXG4gICAgaWYgKHRoaXMubWVkaWFTdHJlYW0gJiYgdGhpcy5tZWRpYVN0cmVhbS5nZXRUcmFja3MpIHtcclxuICAgICAgLy8gcGF1c2UgdmlkZW8gdG8gcHJldmVudCBtb2JpbGUgYnJvd3NlciBmcmVlemVzXHJcbiAgICAgIHRoaXMubmF0aXZlVmlkZW9FbGVtZW50LnBhdXNlKCk7XHJcblxyXG4gICAgICAvLyBnZXRUcmFja3MoKSByZXR1cm5zIGFsbCBtZWRpYSB0cmFja3MgKHZpZGVvK2F1ZGlvKVxyXG4gICAgICB0aGlzLm1lZGlhU3RyZWFtLmdldFRyYWNrcygpXHJcbiAgICAgICAgLmZvckVhY2goKHRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrKSA9PiB0cmFjay5zdG9wKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgZnJvbSBhbGwgb3BlbiBzdWJzY3JpcHRpb25zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB1bnN1YnNjcmliZUZyb21TdWJzY3JpcHRpb25zKCkge1xyXG4gICAgaWYgKHRoaXMudHJpZ2dlclN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhZHMgYXZhaWxhYmxlIGlucHV0IGRldmljZXNcclxuICAgKi9cclxuICBwcml2YXRlIGRldGVjdEF2YWlsYWJsZURldmljZXMoKTogUHJvbWlzZTxNZWRpYURldmljZUluZm9bXT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgV2ViY2FtVXRpbC5nZXRBdmFpbGFibGVWaWRlb0lucHV0cygpXHJcbiAgICAgICAgLnRoZW4oKGRldmljZXM6IE1lZGlhRGV2aWNlSW5mb1tdKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzID0gZGV2aWNlcztcclxuICAgICAgICAgIHJlc29sdmUoZGV2aWNlcyk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICAgIHRoaXMuYXZhaWxhYmxlVmlkZW9JbnB1dHMgPSBbXTtcclxuICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxufVxyXG4iLCI8ZGl2IGNsYXNzPVwid2ViY2FtLXdyYXBwZXJcIiAoY2xpY2spPVwiaW1hZ2VDbGljay5uZXh0KCk7XCI+XHJcbiAgPHZpZGVvICN2aWRlbyBbd2lkdGhdPVwidmlkZW9XaWR0aFwiIFtoZWlnaHRdPVwidmlkZW9IZWlnaHRcIiBbY2xhc3NdPVwidmlkZW9TdHlsZUNsYXNzZXNcIiBhdXRvcGxheSBtdXRlZCBwbGF5c2lubGluZSAocmVzaXplKT1cInZpZGVvUmVzaXplKClcIj48L3ZpZGVvPlxyXG4gIDxkaXYgY2xhc3M9XCJjYW1lcmEtc3dpdGNoXCIgKm5nSWY9XCJhbGxvd0NhbWVyYVN3aXRjaCAmJiBhdmFpbGFibGVWaWRlb0lucHV0cy5sZW5ndGggPiAxICYmIHZpZGVvSW5pdGlhbGl6ZWRcIiAoY2xpY2spPVwicm90YXRlVmlkZW9JbnB1dCh0cnVlKVwiPjwvZGl2PlxyXG4gIDxjYW52YXMgI2NhbnZhcyBbd2lkdGhdPVwid2lkdGhcIiBbaGVpZ2h0XT1cImhlaWdodFwiPjwvY2FudmFzPlxyXG48L2Rpdj5cclxuIl19