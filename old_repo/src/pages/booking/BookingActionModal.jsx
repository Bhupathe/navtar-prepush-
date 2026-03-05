import Modal from '../../components/common/Modal';
import { format } from 'date-fns';

function BookingActionModal({
    isOpen,
    onClose,
    modalType,
    selectedDate,
    selectedStartTime,
    selectedEndTime,
    message,
    onConfirm,
    onDelete,
    confirmLoading = false,
    deleteLoading = false
}) {
    if (!isOpen) return null;

    const title = modalType === 'confirm' ? 'Confirm Booking' :
        modalType === 'delete' ? 'Cancel Booking' :
            'Slot Unavailable';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            {modalType === 'confirm' && selectedDate && (
                <div className='modal-body'>
                    <p>You selected:</p>
                    <strong>Date:</strong> {format(selectedDate, 'MMMM d, yyyy')}<br />
                    <strong>Time:</strong> {selectedStartTime} - {selectedEndTime}
                    <div className="modal-footer">
                        <button
                            className="btn btn-danger" onClick={onClose}
                            disabled={confirmLoading}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary" onClick={onConfirm}
                            disabled={confirmLoading}
                        >
                            {confirmLoading ? (
                                <span>
                                    <span className="spinner" style={{ marginRight: '8px' }}></span>
                                    Processing...
                                </span>
                            ) : "Confirm"}
                        </button>
                    </div>
                </div>
            )}
            {modalType === 'delete' && selectedDate && !isNaN(selectedDate.getTime()) && (
                <div className='modal-body'>
                    <p>Are you sure you want to cancel this booking?</p>
                    <strong>Date:</strong> {format(selectedDate, 'MMMM d, yyyy')}<br />
                    <strong>Time:</strong> {selectedStartTime}
                    <div className="modal-footer">
                        <button className="btn btn-primary" onClick={onClose} disabled={deleteLoading}
                        >No</button>
                        <button
                            className="btn btn-danger"
                            onClick={onDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? (
                                <span>
                                    <span className="spinner" style={{ marginRight: '8px' }}></span>
                                    Deleting...
                                </span>
                            ) : "Yes"}
                        </button>
                    </div>
                </div>
            )}
            {modalType === 'booked' && (
                <div className='modal-body'>
                    <p>{message}</p>
                    <div className="modal-footer">
                        <button className="btn btn-primary" onClick={onClose}>OK</button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
export default BookingActionModal;
