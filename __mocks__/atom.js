const atom = {
    CompositeDisposable: jest.fn(() => {
        return {
            add: jest.fn()
        }
    })
}

module.exports = atom;
