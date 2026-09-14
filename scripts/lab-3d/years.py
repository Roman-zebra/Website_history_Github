"""Photo pairs and camera settings for every year that gets a height grid.

Positions are pixels in the left photo, read off the 900 px previews.
"""

CONFIGS = {
    '1962': {
        'out': 'out',
        'left': 'MKU628-C18-3.jpg',           # Hashima near the centre of this frame
        'right': 'MKU628-C18-2.jpg',
        'focal_mm': 152.670,                  # RMK, printed on the frame as c=152,67
        'pitch_mm': 25.4 / 400,               # 400 dpi scan of the film
        'centre': (2157.0, 1907.0),
        'frame': (150, 3650, 180, 3680),      # y0, y1, x0, x1 of the picture (no border, no data strip)
        'fiducials': {'top': (1916, 114), 'bottom': (1907, 3646), 'left': (145, 1853), 'right': (3687, 1853)},
        'strip': (900, 3000, 3700, 4087),     # data strip with the altimeter
        'altimeter_m': 1950,
        'principal_point': (1912.0, 1853.0),
        # Floating or fixed objects used as checks (crop pixels).
        'probes': {'boat (oval)': (502, 677), 'small boat a': (432, 690), 'small boat b': (462, 694),
                   'pier': (614, 610), 'NE yard': (757, 452), 'SW tip': (252, 622)},
    },
    '2010': {
        'out': 'out2010',
        'left': 'CKU20103-C44-13.jpg',
        'right': 'CKU20103-C44-12.jpg',
        'focal_mm': 120.0,                    # DMC digital camera
        'pitch_mm': 165.888 / 4354,           # 13,824 px x 12 um sensor delivered as 4,354 px
        'centre': (1814.0, 1161.0),
        'frame': (0, 2419, 0, 4354),
        'fiducials': None,
        'strip': None,
        'altimeter_m': None,
        'principal_point': (2177.0, 1209.5),  # digital frame: the image centre
        'probes': {},
    },
}
