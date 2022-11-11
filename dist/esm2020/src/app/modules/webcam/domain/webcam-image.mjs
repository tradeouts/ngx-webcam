/**
 * Container class for a captured webcam image
 * @author basst314, davidshen84
 */
export class WebcamImage {
    constructor(imageAsDataUrl, mimeType, imageData) {
        this._mimeType = null;
        this._imageAsBase64 = null;
        this._imageAsDataUrl = null;
        this._imageData = null;
        this._mimeType = mimeType;
        this._imageAsDataUrl = imageAsDataUrl;
        this._imageData = imageData;
    }
    /**
     * Extracts the Base64 data out of the given dataUrl.
     * @param dataUrl the given dataUrl
     * @param mimeType the mimeType of the data
     */
    static getDataFromDataUrl(dataUrl, mimeType) {
        return dataUrl.replace(`data:${mimeType};base64,`, '');
    }
    /**
     * Get the base64 encoded image data
     * @returns base64 data of the image
     */
    get imageAsBase64() {
        return this._imageAsBase64 ? this._imageAsBase64
            : this._imageAsBase64 = WebcamImage.getDataFromDataUrl(this._imageAsDataUrl, this._mimeType);
    }
    /**
     * Get the encoded image as dataUrl
     * @returns the dataUrl of the image
     */
    get imageAsDataUrl() {
        return this._imageAsDataUrl;
    }
    /**
     * Get the ImageData object associated with the canvas' 2d context.
     * @returns the ImageData of the canvas's 2d context.
     */
    get imageData() {
        return this._imageData;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViY2FtLWltYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2FwcC9tb2R1bGVzL3dlYmNhbS9kb21haW4vd2ViY2FtLWltYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7R0FHRztBQUNILE1BQU0sT0FBTyxXQUFXO0lBRXRCLFlBQW1CLGNBQXNCLEVBQUUsUUFBZ0IsRUFBRSxTQUFvQjtRQU1oRSxjQUFTLEdBQVcsSUFBSSxDQUFDO1FBQ2xDLG1CQUFjLEdBQVcsSUFBSSxDQUFDO1FBQ3JCLG9CQUFlLEdBQVcsSUFBSSxDQUFDO1FBQy9CLGVBQVUsR0FBYyxJQUFJLENBQUM7UUFSNUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDMUIsSUFBSSxDQUFDLGVBQWUsR0FBRyxjQUFjLENBQUM7UUFDdEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7SUFDOUIsQ0FBQztJQVFEOzs7O09BSUc7SUFDSyxNQUFNLENBQUMsa0JBQWtCLENBQUMsT0FBZSxFQUFFLFFBQWdCO1FBQ2pFLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLFFBQVEsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFXLGFBQWE7UUFDdEIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztZQUM5QyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxXQUFXLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQVcsY0FBYztRQUN2QixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUIsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQVcsU0FBUztRQUNsQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztDQUVGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIENvbnRhaW5lciBjbGFzcyBmb3IgYSBjYXB0dXJlZCB3ZWJjYW0gaW1hZ2VcclxuICogQGF1dGhvciBiYXNzdDMxNCwgZGF2aWRzaGVuODRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBXZWJjYW1JbWFnZSB7XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihpbWFnZUFzRGF0YVVybDogc3RyaW5nLCBtaW1lVHlwZTogc3RyaW5nLCBpbWFnZURhdGE6IEltYWdlRGF0YSkge1xyXG4gICAgdGhpcy5fbWltZVR5cGUgPSBtaW1lVHlwZTtcclxuICAgIHRoaXMuX2ltYWdlQXNEYXRhVXJsID0gaW1hZ2VBc0RhdGFVcmw7XHJcbiAgICB0aGlzLl9pbWFnZURhdGEgPSBpbWFnZURhdGE7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlYWRvbmx5IF9taW1lVHlwZTogc3RyaW5nID0gbnVsbDtcclxuICBwcml2YXRlIF9pbWFnZUFzQmFzZTY0OiBzdHJpbmcgPSBudWxsO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2ltYWdlQXNEYXRhVXJsOiBzdHJpbmcgPSBudWxsO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2ltYWdlRGF0YTogSW1hZ2VEYXRhID0gbnVsbDtcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEV4dHJhY3RzIHRoZSBCYXNlNjQgZGF0YSBvdXQgb2YgdGhlIGdpdmVuIGRhdGFVcmwuXHJcbiAgICogQHBhcmFtIGRhdGFVcmwgdGhlIGdpdmVuIGRhdGFVcmxcclxuICAgKiBAcGFyYW0gbWltZVR5cGUgdGhlIG1pbWVUeXBlIG9mIHRoZSBkYXRhXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0RGF0YUZyb21EYXRhVXJsKGRhdGFVcmw6IHN0cmluZywgbWltZVR5cGU6IHN0cmluZykge1xyXG4gICAgcmV0dXJuIGRhdGFVcmwucmVwbGFjZShgZGF0YToke21pbWVUeXBlfTtiYXNlNjQsYCwgJycpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBiYXNlNjQgZW5jb2RlZCBpbWFnZSBkYXRhXHJcbiAgICogQHJldHVybnMgYmFzZTY0IGRhdGEgb2YgdGhlIGltYWdlXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBpbWFnZUFzQmFzZTY0KCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5faW1hZ2VBc0Jhc2U2NCA/IHRoaXMuX2ltYWdlQXNCYXNlNjRcclxuICAgICAgOiB0aGlzLl9pbWFnZUFzQmFzZTY0ID0gV2ViY2FtSW1hZ2UuZ2V0RGF0YUZyb21EYXRhVXJsKHRoaXMuX2ltYWdlQXNEYXRhVXJsLCB0aGlzLl9taW1lVHlwZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGVuY29kZWQgaW1hZ2UgYXMgZGF0YVVybFxyXG4gICAqIEByZXR1cm5zIHRoZSBkYXRhVXJsIG9mIHRoZSBpbWFnZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgaW1hZ2VBc0RhdGFVcmwoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLl9pbWFnZUFzRGF0YVVybDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgSW1hZ2VEYXRhIG9iamVjdCBhc3NvY2lhdGVkIHdpdGggdGhlIGNhbnZhcycgMmQgY29udGV4dC5cclxuICAgKiBAcmV0dXJucyB0aGUgSW1hZ2VEYXRhIG9mIHRoZSBjYW52YXMncyAyZCBjb250ZXh0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgaW1hZ2VEYXRhKCk6IEltYWdlRGF0YSB7XHJcbiAgICByZXR1cm4gdGhpcy5faW1hZ2VEYXRhO1xyXG4gIH1cclxuXHJcbn1cclxuIl19